import { useEffect, useState } from 'react';
import io from 'socket.io-client';
import styles from '../styles/Chat.module.css';  // CSSモジュールをインポート

const Home = () => {
    const [socket, setSocket] = useState(null);
    const [username, setUsername] = useState('');
    const [message, setMessage] = useState('');
    const [messages, setMessages] = useState([]);
    const [connections, setConnections] = useState(0);
    const [isLoggedIn, setIsLoggedIn] = useState(false);
    const [gameStarted, setGameStarted] = useState(false);
    const [currentPlayer, setCurrentPlayer] = useState('');
    const [nextPlayer, setNextPlayer] = useState('');
    const [users, setUsers] = useState([]);
    const [isAddingBannedWord, setIsAddingBannedWord] = useState(false); // 禁止単語追加モードかどうか

    useEffect(() => {
        const socketIo = io();

        socketIo.on('connect', () => {
            console.log('Connected to server');
        });

        socketIo.on('message', ({ username, msg }) => {
            setMessages((prevMessages) => [...prevMessages, { username, msg }]);
        });

        socketIo.on('updateMessages', (currentMessages) => {
            setMessages(currentMessages);
        });

        socketIo.on('resetGame', () => {
            setMessages([]);
            setGameStarted(false);
            setCurrentPlayer('');
            setNextPlayer('');
            console.log('Game has been reset');
        });

        socketIo.on('gameOver', () => {
            setMessages([]);
            setGameStarted(false);
            setCurrentPlayer('');
            setNextPlayer('');
            console.log('Game over due to word used three times');
            alert('ゲームオーバー！同じ単語が3回使用されました。');
        });

        socketIo.on('warning', (msg) => {
            alert(`この単語は使えないよ！！: ${msg}`);
            console.log(`Warning received for word: ${msg}`);
        });

        socketIo.on('error', (errMsg) => {
            alert(errMsg);
            console.log(`Error: ${errMsg}`);
        });

        socketIo.on('updateConnections', (currentConnections) => {
            console.log('Current connections updated:', currentConnections);
            setConnections(currentConnections);
        });

        socketIo.on('updateUsers', (currentUsers) => {
            setUsers(currentUsers);
        });

        socketIo.on('userJoined', (username) => {
            setMessages((prevMessages) => [...prevMessages, { username: 'System', msg: `${username}が参加しました` }]);
        });

        socketIo.on('gameStarted', (username) => {
            setCurrentPlayer(username);
            setGameStarted(true);
            alert(`ゲーム開始！最初のプレイヤーは ${username} です。`);
        });

        socketIo.on('nextPlayer', (username) => {
            setNextPlayer(username);
        });

        socketIo.on('gameAlreadyStarted', () => {
            setGameStarted(true);
        });

        socketIo.on('bannedWordAdded', (newWord) => {
            // setBannedWords((prevWords) => [...prevWords, newWord]); // 現在の禁止単語リストは表示しないため、この行を削除
        });

        setSocket(socketIo);

        return () => {
            socketIo.disconnect();
        };
    }, []);

    const sendMessage = () => {
        if (message) {
            if (isAddingBannedWord) {
                socket.emit('addBannedWord', message); // 禁止単語追加モードの場合はサーバーにイベントを送信
                setIsAddingBannedWord(false); // 禁止単語追加モードを解除
            } else {
                socket.emit('message', { username, msg: message }); // 通常のメッセージ送信
            }
            setMessage('');
        }
    };

    const handleLogin = () => {
        if (username) {
            setIsLoggedIn(true);
            socket.emit('join', username);
        } else {
            alert('ユーザーネームを入力してください。');
        }
    };

    const startGame = () => {
        socket.emit('startGame');
    };

    if (!isLoggedIn) {
        return (
            <div className={styles.container}>
                <h1>Shiritori_mania</h1>
                <input
                    className={styles.input}
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    placeholder="Enter your username"
                />
                <button className={styles.button} onClick={handleLogin}>Join Game</button>
            </div>
        );
    }

    if (!gameStarted) {
        return (
            <div className={styles.container}>
                <h1>Shiritori_mania</h1>
                <p>現在の参加人数: {connections}</p>
                <p>参加者:</p>
                <ul className={styles.userList}>
                    {users.map((user, index) => (
                        <li key={index} className={styles.user}>{user}</li>
                    ))}
                </ul>
                <button className={styles.button} onClick={startGame}>Start Game</button>
                <ul className={styles.messageList}>
                    {messages.map((msg, index) => (
                        <li key={index} className={`${styles.message} ${msg.username === username ? styles.myMessage : ''}`}>
                            <span className={styles.username}>{msg.username}</span>: {msg.msg}
                        </li>
                    ))}
                </ul>
            </div>
        );
    }

    return (
        <div className={styles.container}>
            <h1>Shiritori_mania</h1>
            <p>現在の参加人数: {connections}</p>
            <p>最初のプレイヤー: {currentPlayer}</p>
            <p>次のプレイヤー: {nextPlayer}</p>
            <div className={styles.chatContainer}>
                <ul className={styles.messageList}>
                    {messages.map((msg, index) => (
                        <li key={index} className={`${styles.message} ${msg.username === username ? styles.myMessage : ''}`}>
                            <span className={styles.username}>{msg.username}</span>: {msg.msg}
                        </li>
                    ))}
                </ul>
            </div>
            <div className={styles.inputContainer}>
                <input
                    className={styles.input}
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    placeholder={isAddingBannedWord ? '禁止単語を入力' : '単語を入力'}
                />
                <button className={styles.button} onClick={sendMessage}>
                    {isAddingBannedWord ? '追加' : '送る'}
                </button>
                <button className={styles.button} onClick={() => setIsAddingBannedWord(!isAddingBannedWord)}>
                    {isAddingBannedWord ? '↩︎' : '+'}
                </button>
            </div>
        </div>
    );
};

export default Home;