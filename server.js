const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const fs = require('fs');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

// Serve static files from 'public' directory
app.use(express.static('public'));
app.use(express.json());

// Paths for persistence
const USERS_FILE = path.join(__dirname, 'data', 'users.json');
const MAP_FILE = path.join(__dirname, 'data', 'map.json');
const CHAT_LOG_FILE = path.join(__dirname, 'data', 'chat_logs.txt');

// Ensure data directory exists
if (!fs.existsSync(path.join(__dirname, 'data'))) {
    fs.mkdirSync(path.join(__dirname, 'data'));
}

// Helper functions for persistence
function loadData() {
    let users = {};
    let mapState = {};

    if (fs.existsSync(USERS_FILE)) {
        try {
            users = JSON.parse(fs.readFileSync(USERS_FILE, 'utf8'));
        } catch (e) {
            console.error("Users file corrupted, starting fresh.");
        }
    }

    if (fs.existsSync(MAP_FILE)) {
        try {
            mapState = JSON.parse(fs.readFileSync(MAP_FILE, 'utf8'));
        } catch (e) {
            console.error("Map file corrupted, starting fresh.");
        }
    }

    return { users, mapState };
}

function saveUsers() {
    fs.writeFileSync(USERS_FILE, JSON.stringify(users, null, 2));
}

function saveMap() {
    fs.writeFileSync(MAP_FILE, JSON.stringify(mapState, null, 2));
}

function checkMonthlyReset(users) {
    const currentMonth = new Date().toISOString().slice(0, 7); // e.g., "2026-05"
    let updated = false;
    for (const email in users) {
        if (!users[email].lastMonth) {
            users[email].lastMonth = currentMonth;
            updated = true;
        } else if (users[email].lastMonth !== currentMonth) {
            users[email].monthlyConquered = 0;
            users[email].monthlyKills = 0;
            users[email].lastMonth = currentMonth;
            updated = true;
        }
        
        if (users[email].totalConquered === undefined) { users[email].totalConquered = 0; updated = true; }
        if (users[email].monthlyConquered === undefined) { users[email].monthlyConquered = 0; updated = true; }
        if (users[email].totalKills === undefined) { users[email].totalKills = 0; updated = true; }
        if (users[email].monthlyKills === undefined) { users[email].monthlyKills = 0; updated = true; }
    }
    return updated;
}

// Initial Data Load
const initialData = loadData();
let users = initialData.users;
let mapState = initialData.mapState;

if (checkMonthlyReset(users)) {
    saveUsers();
}

// Backfill missing properties for old map cells
let mapNeedsSave = false;
for (const cellId in mapState) {
    const ownerEmail = mapState[cellId].owner;
    if (ownerEmail && users[ownerEmail]) {
        const user = users[ownerEmail];
        if (!mapState[cellId].ownerName || mapState[cellId].ownerName === ownerEmail.split('@')[0]) {
            mapState[cellId].ownerName = user.username;
            mapNeedsSave = true;
        }
        if (!mapState[cellId].emoji) {
            mapState[cellId].emoji = user.emoji || '🏰';
            mapNeedsSave = true;
        }
    }
}
if (mapNeedsSave) saveMap();

const pendingUsers = {}; 
const players = {}; 

io.on('connection', (socket) => {
    console.log(`[+] Player connected: ${socket.id}`);
    
    socket.emit('init_map', mapState);

    // Player joins the map after auth
    socket.on('player_join', (data) => {
        const userEmail = data.email;
        const savedUser = users[userEmail];

        players[socket.id] = { 
            username: savedUser ? savedUser.username : data.username,
            email: userEmail,
            score: savedUser ? savedUser.score : 0, 
            color: savedUser ? savedUser.color : (data.color || '#ff3b30'),
            emoji: savedUser ? savedUser.emoji : (data.emoji || '🏰'),
            coins: savedUser ? savedUser.coins : 1250,
            castle: savedUser ? savedUser.castle : null 
        };

        console.log(`[JOIN] ${players[socket.id].username} (${userEmail}) oyuna katıldı. Puan: ${players[socket.id].score}, Para: ${players[socket.id].coins}`);
        
        // Oyuncuya kendi güncel verilerini geri gönder (Senkronizasyon için)
        socket.emit('auth_success', { user: savedUser || players[socket.id] });
    });

    // Player updates info (name, color)
    socket.on('player_update', (data) => {
        if (players[socket.id]) {
            if (data.username) players[socket.id].username = data.username;
            if (data.color) players[socket.id].color = data.color;
            if (data.emoji) players[socket.id].emoji = data.emoji;
        }
    });

    // Player conquers a cell
    socket.on('conquer_cell', (data) => {
        const cellId = data.id;
        const isCastle = data.isCastle || false;

        // Check if this cell is someone else's castle
        for (const cid in mapState) {
            if (mapState[cid].isCastle && cid === cellId) {
                const ownerEmail = mapState[cid].owner;
                const playerEmail = players[socket.id]?.email;

                if (ownerEmail && ownerEmail !== playerEmail) {
                    console.log(`[!] ${players[socket.id]?.username} captured ${ownerEmail}'s castle!`);
                    
                    // Increment kills for the attacker
                    if (playerEmail && users[playerEmail]) {
                        users[playerEmail].totalKills = (users[playerEmail].totalKills || 0) + 1;
                        users[playerEmail].monthlyKills = (users[playerEmail].monthlyKills || 0) + 1;
                    }

                    // Clear defeated player's state in users object
                    if (users[ownerEmail]) {
                        users[ownerEmail].score = 0;
                        users[ownerEmail].castle = null;
                        saveUsers();
                    }

                    // Remove their cells from map
                    for (const mid in mapState) {
                        if (mapState[mid].owner === ownerEmail) {
                            delete mapState[mid];
                        }
                    }
                    
                    io.emit('player_wiped', { email: ownerEmail });
                    io.emit('init_map', mapState); 
                    break;
                }
            }
        }
        
        const player = players[socket.id];
        if (!player) return;
        const user = users[player.email];

        mapState[cellId] = {
            owner: player.email,
            ownerName: player.username || (user && user.username) || player.email.split('@')[0],
            color: player.color || data.color,
            emoji: player.emoji || data.emoji || '🏰',
            isCastle: isCastle
        };

        if (isCastle && user) {
            user.castle = cellId;
            player.castle = cellId;
        }

        player.score += 5;
        if(user) {
            user.score = player.score;
            user.totalConquered = (user.totalConquered || 0) + 1;
            user.monthlyConquered = (user.monthlyConquered || 0) + 1;
            saveUsers();
        }
        saveMap(); // Save map on every conquest

        socket.broadcast.emit('cell_conquered', {
            id: cellId,
            color: mapState[cellId].color,
            emoji: mapState[cellId].emoji,
            isCastle: isCastle,
            owner: mapState[cellId].owner,
            ownerName: mapState[cellId].ownerName
        });
    });

    // Para güncelleme (Harcanan parayı kaydet)
    socket.on('update_coins', (data) => {
        const player = players[socket.id];
        if (player && player.email && users[player.email]) {
            users[player.email].coins = data.coins;
            saveUsers();
        }
    });

    // Renk ve Satın Alınan Renkleri Güncelleme
    socket.on('update_colors', (data) => {
        const player = players[socket.id];
        if (player && player.email && users[player.email]) {
            if (data.color) {
                users[player.email].color = data.color;
                player.color = data.color; // Aktif session rengini de güncelle

                // Haritadaki oyuncuya ait bölgelerin rengini güncelle
                let changed = false;
                for (const cellId in mapState) {
                    if (mapState[cellId].owner === player.email) {
                        mapState[cellId].color = data.color;
                        changed = true;
                    }
                }

                if (changed) {
                    saveMap();
                    io.emit('init_map', mapState); // Tüm istemcilere güncel haritayı gönder
                }
            }
            if (data.ownedColors) {
                users[player.email].ownedColors = data.ownedColors;
            }
            saveUsers();
        }
    });

    // Emoji ve Satın Alınan Emojileri Güncelleme
    socket.on('update_emojis', (data) => {
        const player = players[socket.id];
        if (player && player.email && users[player.email]) {
            if (data.emoji) {
                users[player.email].emoji = data.emoji;
                player.emoji = data.emoji;

                // Haritadaki oyuncuya ait bölgelerin emojisini güncelle
                let changed = false;
                for (const cellId in mapState) {
                    if (mapState[cellId].owner === player.email) {
                        mapState[cellId].emoji = data.emoji;
                        changed = true;
                    }
                }

                if (changed) {
                    saveMap();
                    io.emit('init_map', mapState);
                }
            }
            if (data.ownedEmojis) {
                users[player.email].ownedEmojis = data.ownedEmojis;
            }
            saveUsers();
        }
    });

    // Sohbet Mesajı
    socket.on('chat_message', (data) => {
        const player = players[socket.id];
        let username = player ? player.username : 'Oyuncu';
        let color = player ? player.color : '#fff';
        let emoji = player ? player.emoji : '🏰';

        // Eğer oyuncu verisi varsa, en güncel bilgileri users objesinden alalım
        if (player && player.email && users[player.email]) {
            const userData = users[player.email];
            username = userData.username || username;
            color = userData.color || color;
            emoji = userData.emoji || emoji;
        }

        if (data.message) {
            const cleanMessage = data.message.substring(0, 100); // 100 karakter sınırı
            
            // Sohbet geçmişini dosyaya kaydet
            const timestamp = new Date().toLocaleString('tr-TR');
            const logEntry = `[${timestamp}] ${username} (${emoji}): ${cleanMessage}\n`;
            
            try {
                fs.appendFileSync(CHAT_LOG_FILE, logEntry, 'utf8');
            } catch (err) {
                console.error("Sohbet günlüğü kaydedilemedi:", err);
            }

            io.emit('chat_message', {
                username: username,
                color: color,
                emoji: emoji,
                message: cleanMessage
            });
        }
    });

    socket.on('disconnect', () => {
        console.log(`[-] Player disconnected: ${socket.id}`);
        delete players[socket.id];
    });
});

// --- AUTH API ---
function generateCode() {
    return Math.floor(100000 + Math.random() * 900000).toString();
}

app.post('/api/register', (req, res) => {
    const { email, password, username } = req.body;
    if (!email || !password || !username) return res.status(400).json({ error: 'Tüm alanlar gereklidir.' });
    if (users[email]) return res.status(400).json({ error: 'Bu e-posta zaten kayıtlı.' });

    const code = generateCode();
    pendingUsers[email] = { 
        username,
        password, 
        code, 
        expires: Date.now() + 10 * 60 * 1000 // 10 minutes
    };

    console.log(`\n--- VERIFICATION CODE FOR ${email} ---`);
    console.log(`CODE: ${code}`);
    console.log(`----------------------------------------\n`);

    res.json({ message: 'Doğrulama kodu gönderildi.' });
});

app.post('/api/verify', (req, res) => {
    const { email, code } = req.body;
    const pending = pendingUsers[email];

    if (!pending) return res.status(400).json({ error: 'Kayıt bulunamadı.' });
    if (pending.code !== code) return res.status(400).json({ error: 'Geçersiz kod.' });
    if (Date.now() > pending.expires) {
        delete pendingUsers[email];
        return res.status(400).json({ error: 'Kodun süresi dolmuş.' });
    }

    // Success - Create user
    const playerId = Math.random().toString(36).substring(2, 8).toUpperCase();
    users[email] = {
        email,
        password: pending.password,
        username: pending.username,
        id: playerId,
        score: 0,
        coins: 1250, // Başlangıç parası
        color: '#ff3b30', // Varsayılan renk
        emoji: '🏰', // Varsayılan emoji
        ownedColors: ['#ff3b30', '#0a84ff', '#34c759', '#ffcc00', '#ff9500', '#af52de', '#ff2d55', '#ffffff'], // Başlangıç renkleri
        ownedEmojis: ['🏰'], // Başlangıç emojileri
        castle: null,
        totalConquered: 0,
        monthlyConquered: 0,
        totalKills: 0,
        monthlyKills: 0,
        lastMonth: new Date().toISOString().slice(0, 7)
    };

    saveUsers(); // Persist new user
    delete pendingUsers[email];
    res.json({ message: 'Hesap başarıyla oluşturuldu!', user: users[email] });
});

app.post('/api/login', (req, res) => {
    const { email, password } = req.body;
    const user = users[email];

    if (!user || user.password !== password) {
        return res.status(400).json({ error: 'Geçersiz e-posta veya şifre.' });
    }

    // Check if user is already logged in via active sockets
    const isAlreadyLoggedIn = Object.values(players).some(p => p.email === email);
    if (isAlreadyLoggedIn) {
        return res.status(403).json({ error: 'Bu hesap şu anda başka bir cihazda veya sekmede aktif.' });
    }

    res.json({ message: 'Giriş başarılı!', user: user });
});

// Broadcast leaderboards every 5 seconds to all connected clients
setInterval(() => {
    if (checkMonthlyReset(users)) {
        saveUsers();
    }

    // Global leaderboards (from all users)
    const allUsers = Object.values(users);
    
    // Calculate current territory counts
    const currentScores = {};
    for (const cellId in mapState) {
        const ownerEmail = mapState[cellId].owner;
        if (ownerEmail) {
            currentScores[ownerEmail] = (currentScores[ownerEmail] || 0) + 1;
        }
    }

    // 1. Match Leaderboard (Everyone with territory on map + others)
    const leaderboard = Object.keys(users)
        .map(email => {
            const u = users[email];
            const count = currentScores[email] || 0;
            const isOnline = Object.values(players).some(p => p.email === email);
            return { 
                username: u.username, 
                score: count * 5, 
                color: u.color, 
                emoji: u.emoji,
                isOnline: isOnline,
                kills: u.totalKills || 0
            };
        })
        .sort((a, b) => b.score - a.score)
        .slice(0, 10);
        
    io.emit('leaderboard_update', leaderboard);
    
    // 0 & 1. Area All-Time (Now reflects Active Map State / Genel Sıralama)
    const areaAllTime = Object.keys(users)
        .map(email => {
            const u = users[email];
            const count = currentScores[email] || 0;
            return {
                username: u.username,
                score: count * 5,
                kills: u.totalKills || 0,
                color: u.color,
                emoji: u.emoji
            };
        })
        .sort((a, b) => b.score - a.score)
        .slice(0, 50);

    // 2. Area Monthly (Cumulative clicks this month)
    const areaMonthly = allUsers
        .map(u => ({ username: u.username, score: (u.monthlyConquered || 0) * 5, kills: u.monthlyKills || 0, color: u.color, emoji: u.emoji }))
        .sort((a, b) => b.score - a.score)
        .slice(0, 50);

    // 3. Kills All-Time
    const killsAllTime = allUsers
        .map(u => ({ username: u.username, score: (u.totalConquered || 0) * 5, kills: u.totalKills || 0, color: u.color, emoji: u.emoji }))
        .sort((a, b) => b.kills - a.kills)
        .slice(0, 50);

    // 4. Kills Monthly
    const killsMonthly = allUsers
        .map(u => ({ username: u.username, score: (u.monthlyConquered || 0) * 5, kills: u.monthlyKills || 0, color: u.color, emoji: u.emoji }))
        .sort((a, b) => b.kills - a.kills)
        .slice(0, 50);
        
    io.emit('global_leaderboard_update', { 
        areaAllTime, 
        areaMonthly, 
        killsAllTime, 
        killsMonthly 
    });
}, 5000);

const PORT = process.env.PORT || 3169;
server.listen(PORT, '0.0.0.0', () => {
    console.log(`Sunucu başlatıldı: http://localhost:${PORT}`);
});
