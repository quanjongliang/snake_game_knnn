import React, { useState, useEffect, useCallback } from 'react';
import { db } from '../firebase';
import { collection, addDoc, query, orderBy, limit, getDocs, onSnapshot, where, updateDoc, doc } from 'firebase/firestore';
import FingerprintJS from '@fingerprintjs/fingerprintjs';
import './SnakeGame.css';
import EmojiPicker from 'emoji-picker-react';

const GRID_SIZE = 20;
const CELL_SIZE = 20;
const INITIAL_SNAKE = [
    { x: 10, y: 10 },
    { x: 10, y: 11 },
];
const INITIAL_DIRECTION = 'UP';
const INITIAL_FOOD = { x: 5, y: 5 };
const SPEED = 150;

const SnakeGame = () => {
    const [snake, setSnake] = useState(INITIAL_SNAKE);
    const [direction, setDirection] = useState(INITIAL_DIRECTION);
    const [food, setFood] = useState(INITIAL_FOOD);
    const [isGameOver, setIsGameOver] = useState(false);
    const [score, setScore] = useState(0);
    const [highScores, setHighScores] = useState([]);
    const [playerName, setPlayerName] = useState('');
    const [highestScore, setHighestScore] = useState(0);
    const [deviceInfo, setDeviceInfo] = useState(null);
    const [messages, setMessages] = useState([]);
    const [newMessage, setNewMessage] = useState('');
    const [showEmojiPicker, setShowEmojiPicker] = useState(false);

    // Tạo thức ăn mới
    const generateFood = useCallback(() => {
        const newFood = {
            x: Math.floor(Math.random() * GRID_SIZE),
            y: Math.floor(Math.random() * GRID_SIZE),
        };
        setFood(newFood);
    }, []);

    // Di chuyển rắn
    const moveSnake = useCallback(() => {
        if (isGameOver) return;

        const newSnake = [...snake];
        const head = { ...newSnake[0] };

        const checkCollision = (head) => {
            // Va chạm với tường
            if (
                head.x < 0 ||
                head.x >= GRID_SIZE ||
                head.y < 0 ||
                head.y >= GRID_SIZE
            ) {
                return true;
            }

            // Va chạm với thân rắn
            for (let segment of snake) {
                if (head.x === segment.x && head.y === segment.y) {
                    return true;
                }
            }
            return false;
        };

        switch (direction) {
            case 'UP':
                head.y -= 1;
                break;
            case 'DOWN':
                head.y += 1;
                break;
            case 'LEFT':
                head.x -= 1;
                break;
            case 'RIGHT':
                head.x += 1;
                break;
            default:
                break;
        }

        if (checkCollision(head)) {
            setIsGameOver(true);
            return;
        }

        newSnake.unshift(head);

        if (head.x === food.x && head.y === food.y) {
            setScore(score + 1);
            generateFood();
        } else {
            newSnake.pop();
        }

        setSnake(newSnake);
    }, [snake, direction, food, isGameOver, score, generateFood]);

    // Xử lý phím
    const handleKeyPress = useCallback(
        (event) => {
            switch (event.key) {
                case 'ArrowUp':
                    if (direction !== 'DOWN') setDirection('UP');
                    break;
                case 'ArrowDown':
                    if (direction !== 'UP') setDirection('DOWN');
                    break;
                case 'ArrowLeft':
                    if (direction !== 'RIGHT') setDirection('LEFT');
                    break;
                case 'ArrowRight':
                    if (direction !== 'LEFT') setDirection('RIGHT');
                    break;
                default:
                    break;
            }
        },
        [direction]
    );

    // Reset game
    const resetGame = () => {
        setSnake(INITIAL_SNAKE);
        setDirection(INITIAL_DIRECTION);
        setFood(INITIAL_FOOD);
        setIsGameOver(false);
        setScore(0);
    };

    useEffect(() => {
        const gameLoop = setInterval(moveSnake, SPEED);
        window.addEventListener('keydown', handleKeyPress);

        return () => {
            clearInterval(gameLoop);
            window.removeEventListener('keydown', handleKeyPress);
        };
    }, [moveSnake, handleKeyPress]);

    useEffect(() => {
        const highScoresRef = collection(db, 'highscores');
        const q = query(highScoresRef, orderBy('score', 'desc'), limit(5));

        // Tạo listener cho realtime updates
        const unsubscribe = onSnapshot(q, (snapshot) => {
            const scores = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            }));
            setHighScores(scores);

            // Cập nhật điểm cao nhất
            if (scores.length > 0) {
                setHighestScore(scores[0].score);
            }
        });

        // Cleanup listener khi component unmount
        return () => unsubscribe();
    }, []);

    // Thêm useEffect để lấy device info khi component mount
    useEffect(() => {
        const getDeviceInfo = async () => {
            // Lấy IP
            const ipResponse = await fetch('https://api.ipify.org?format=json');
            const { ip } = await ipResponse.json();

            // Lấy device fingerprint
            const fp = await FingerprintJS.load();
            const result = await fp.get();
            const deviceId = result.visitorId;

            setDeviceInfo({ ip, deviceId });
        };

        getDeviceInfo();
    }, []);

    // Sửa lại hàm saveScore để kiểm tra và cập nhật điểm
    const saveScore = async () => {
        if (!playerName.trim() || score <= 0 || !deviceInfo) return;

        try {
            const highScoresRef = collection(db, 'highscores');

            // Tìm kiếm điểm hiện có của device này
            const q = query(
                highScoresRef,
                where('deviceId', '==', deviceInfo.deviceId)
            );
            const querySnapshot = await getDocs(q);

            if (!querySnapshot.empty) {
                // Nếu đã có điểm của device này
                const existingScore = querySnapshot.docs[0];
                const existingScoreData = existingScore.data();

                // Chỉ cập nhật nếu điểm mới cao hơn
                if (score > existingScoreData.score) {
                    await updateDoc(doc(db, 'highscores', existingScore.id), {
                        name: playerName,
                        score: score,
                        timestamp: new Date(),
                        ip: deviceInfo.ip,
                        deviceId: deviceInfo.deviceId
                    });
                }
            } else {
                // Nếu chưa có điểm của device này
                await addDoc(highScoresRef, {
                    name: playerName,
                    score: score,
                    timestamp: new Date(),
                    ip: deviceInfo.ip,
                    deviceId: deviceInfo.deviceId
                });
            }
        } catch (error) {
            console.error("Error saving score:", error);
        }
    };

    useEffect(() => {
        const messagesRef = collection(db, 'messages');
        // Sắp xếp theo timestamp giảm dần (desc) để tin nhắn mới nhất lên đầu
        const q = query(messagesRef, orderBy('timestamp', 'desc'), limit(50));

        const unsubscribe = onSnapshot(q, (snapshot) => {
            const msgs = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            }));
            setMessages(msgs); // Không cần reverse() vì đã sắp xếp desc
        }, (error) => {
            console.error("Error fetching messages:", error);
        });

        return () => unsubscribe();
    }, []);

    const sendMessage = async (e) => {
        e.preventDefault();
        if (!newMessage.trim() || !playerName.trim()) {
            alert('Vui lòng nhập tên và nội dung tin nhắn!');
            return;
        }

        try {
            const messagesRef = collection(db, 'messages');
            await addDoc(messagesRef, {
                text: newMessage.trim(),
                name: playerName.trim(),
                timestamp: new Date(),
            });
            setNewMessage('');
        } catch (error) {
            console.error("Error sending message:", error);
            alert('Không thể gửi tin nhắn: ' + error.message);
        }
    };

    // Thêm hàm format thời gian
    const formatTime = (timestamp) => {
        if (!timestamp) return '';
        const date = timestamp.toDate(); // Chuyển Firestore Timestamp thành Date
        return date.toLocaleTimeString('vi-VN', {
            hour: '2-digit',
            minute: '2-digit'
        });
    };

    const onEmojiClick = (emojiObject) => {
        setNewMessage(prev => prev + emojiObject.emoji);
        setShowEmojiPicker(false);
    };

    return (
        <div className="game-wrapper">
            <div className="scores-panel">
                <div className="score-info">
                    <p>Current Score: {score}</p>
                    <p>Highest Score: {highestScore}</p>
                </div>
                <div className="high-scores">
                    <h3>High Scores</h3>
                    <ul>
                        {highScores.map((highScore) => (
                            <li key={highScore.id}>
                                <span className="player-name">{highScore.name}</span>
                                <span className="player-score">{highScore.score}</span>
                            </li>
                        ))}
                    </ul>
                </div>
            </div>

            <div className="game-container">
                <div
                    className="game-board"
                    style={{
                        width: GRID_SIZE * CELL_SIZE,
                        height: GRID_SIZE * CELL_SIZE,
                    }}
                >
                    {snake.map((segment, index) => (
                        <div
                            key={index}
                            className="snake-segment"
                            style={{
                                left: segment.x * CELL_SIZE,
                                top: segment.y * CELL_SIZE,
                            }}
                        />
                    ))}
                    <div
                        className="food"
                        style={{
                            left: food.x * CELL_SIZE,
                            top: food.y * CELL_SIZE,
                        }}
                    />
                </div>
                {isGameOver && (
                    <div className="game-over">
                        <h2>Game Over!</h2>
                        <p>Your Score: {score}</p>
                        <input
                            type="text"
                            placeholder="Enter your name"
                            value={playerName}
                            onChange={(e) => setPlayerName(e.target.value)}
                        />
                        <button onClick={saveScore}>Save Score</button>
                        <button onClick={resetGame}>Play Again</button>
                    </div>
                )}
            </div>

            <div className="chat-container">
                <div className="chat-header">
                    Game Chat
                </div>
                <div className="chat-messages"
                    ref={(el) => {
                        if (el) {
                            el.scrollTop = 0; // Scroll to top thay vì scrollHeight
                        }
                    }}>
                    {messages.map((msg) => (
                        <div key={msg.id} className="message">
                            <div className="message-header">
                                <span className="message-name">{msg.name}</span>
                                <span className="message-time">{formatTime(msg.timestamp)}</span>
                            </div>
                            <div className="message-content">
                                <span className="message-text">{msg.text}</span>
                            </div>
                        </div>
                    ))}
                </div>
                <form onSubmit={sendMessage} className="chat-input">
                    <input
                        type="text"
                        placeholder="Nhập tên của bạn..."
                        value={playerName}
                        onChange={(e) => setPlayerName(e.target.value)}
                    />
                    <div className="message-input-container">
                        <input
                            type="text"
                            value={newMessage}
                            onChange={(e) => setNewMessage(e.target.value)}
                            placeholder="Nhập tin nhắn..."
                        />
                        <button
                            type="button"
                            className="emoji-button"
                            onClick={() => setShowEmojiPicker(!showEmojiPicker)}
                        >
                            😊
                        </button>
                        {showEmojiPicker && (
                            <div className="emoji-picker-container">
                                <EmojiPicker
                                    onEmojiClick={onEmojiClick}
                                    width={300}
                                    height={400}
                                />
                            </div>
                        )}
                    </div>
                    <button type="submit">Gửi</button>
                </form>
            </div>
        </div>
    );
};

export default SnakeGame;