const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const next = require('next');
const fs = require('fs');
const path = require('path');

const dev = process.env.NODE_ENV !== 'production';
const app = next({ dev });
const handle = app.getRequestHandler();

let currentConnections = 0;
let messages = [];
let wordCount = {};
let users = [];
let initialUsers = [];
let currentPlayerIndex = 0;
let gameStarted = false;

// 不適切なワードリストを読み込む
const bannedWordsPath = path.join(__dirname, 'banned_words.json');
let bannedWords = [];

fs.readFile(bannedWordsPath, 'utf8', (err, data) => {
    if (err) {
        console.error('Error reading banned words file:', err);
        return;
    }
    bannedWords = JSON.parse(data).bannedWords;
});

app.prepare().then(() => {
    const server = express();
    const httpServer = http.createServer(server);
    const io = socketIo(httpServer);

    io.on('connection', (socket) => {
        currentConnections++;
        io.emit('updateConnections', currentConnections);

        console.log('A user connected, current connections:', currentConnections);

        socket.on('join', (username) => {
            // 不適切な名前チェック（部分一致）
            const containsBannedWordInUsername = bannedWords.some(
                (bannedWord) =>
                    username.toLowerCase().includes(bannedWord.toLowerCase())
            );
            if (containsBannedWordInUsername) {
                socket.emit('error', '不適切な名前は使用できません！！');
                return;
            }

            const user = { id: socket.id, username };
            users.push(user);

            // ゲーム開始後ならinitialUsersにも追加
            if (gameStarted) {
                initialUsers.push(user);
            }

            io.emit('updateUsers', users.map((user) => user.username));
            io.emit('userJoined', username);
            console.log('User joined:', username);

            socket.emit('updateMessages', messages);

            if (gameStarted) {
                socket.emit('gameAlreadyStarted');
            }
        });

        socket.on('startGame', () => {
            if (users.length > 0 && !gameStarted) {
                initialUsers = [...users];
                const randomUser = initialUsers[Math.floor(Math.random() * initialUsers.length)];
                currentPlayerIndex = initialUsers.findIndex(user => user.username === randomUser.username);
                io.emit('gameStarted', randomUser.username);
                gameStarted = true;
                console.log('Game started by:', randomUser.username);
            }
        });

        socket.on('disconnect', () => {
            currentConnections--;
            users = users.filter(user => user.id !== socket.id);
            io.emit('updateConnections', currentConnections);
            io.emit('updateUsers', users.map(user => user.username));

            console.log('A user disconnected, current connections:', currentConnections);
        });

        socket.on('message', ({ username, msg }) => {
            const currentPlayer = initialUsers[currentPlayerIndex].username;

            // 不適切なワードチェック（部分一致）
            const containsBannedWord = bannedWords.some(bannedWord => msg.toLowerCase().includes(bannedWord.toLowerCase()));
            if (containsBannedWord) {
                socket.emit('error', '不適切なワードは使用できません！！');
                return;
            }

            if (msg.startsWith('/')) {
                const normalMessage = { username, msg: msg.slice(1) };
                messages.push(normalMessage);
                io.emit('message', normalMessage);
                return;
            }

            if (username !== currentPlayer) {
                socket.emit('error', '順番ではないのでしりとりのワードを送信できません。');
                return;
            }

            if (msg.endsWith('ん')) {
                resetGame(io);
                console.log('Game reset due to message ending with ん');
            } else {
                if (wordCount[msg] === undefined) {
                    wordCount[msg] = 1;
                } else {
                    wordCount[msg]++;
                }

                if (wordCount[msg] >= 3) {
                    resetGame(io);
                    io.emit('gameOver');
                    console.log('Game over due to word used three times:', msg);
                } else if (wordCount[msg] === 2) {
                    socket.emit('warning', msg);
                    console.log('Warning: Word used twice:', msg);
                } else {
                    const messageWithUser = { username, msg };
                    messages.push(messageWithUser);
                    io.emit('message', messageWithUser);

                    currentPlayerIndex = (currentPlayerIndex + 1) % initialUsers.length;
                    const nextPlayer = initialUsers[currentPlayerIndex].username;
                    io.emit('nextPlayer', nextPlayer);
                    console.log('Next player is:', nextPlayer);
                }
            }
        });

        // 新しい禁止ワードの追加
        socket.on('addBannedWord', (newWord) => {
            // 重複チェック
            if (bannedWords.includes(newWord)) {
                socket.emit('error', 'その単語は既に禁止されています。');
                return;
            }

            // 新しい単語を追加
            bannedWords.push(newWord);

            // banned_words.json に書き込む
            fs.writeFile(bannedWordsPath, JSON.stringify({ bannedWords }), (err) => {
                if (err) {
                    console.error('Error writing banned words to file:', err);
                    socket.emit('error', '単語の追加に失敗しました。');
                } else {
                    console.log('New banned word added:', newWord);
                    io.emit('bannedWordAdded', newWord); // 全クライアントに通知
                }
            });
        });
    });

    server.all('*', (req, res) => {
        return handle(req, res);
    });

    const PORT = process.env.PORT || 3000;
    httpServer.listen(PORT, (err) => {
        if (err) throw err;
        console.log(`Server running on http://localhost:${PORT}`);
    });
});

function resetGame(io) {
    messages = [];
    wordCount = {};
    initialUsers = [];
    gameStarted = false;
    io.emit('resetGame');
}