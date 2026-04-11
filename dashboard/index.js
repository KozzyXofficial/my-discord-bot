const express = require('express');
const app = express();
const port = 80;

app.get('/', (req, res) => {
    res.send(`
        <!DOCTYPE html>
        <html lang="en">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>KozzyX Dashboard</title>
            <style>
                body {
                    background-color: #121212;
                    color: white;
                    font-family: Arial, sans-serif;
                    display: flex;
                    flex-direction: column;
                    align-items: center;
                    justify-content: center;
                    height: 100vh;
                    margin: 0;
                }
                h1 {
                    color: #ffffff;
                }
                .status {
                    margin-bottom: 20px;
                    font-size: 1.2em;
                }
                .button {
                    background-color: #5865F2;
                    color: white;
                    padding: 10px 20px;
                    border: none;
                    border-radius: 5px;
                    font-size: 1em;
                    cursor: pointer;
                    text-decoration: none;
                }
                .button:hover {
                    background-color: #4752C4;
                }
            </style>
        </head>
        <body>
            <h1>🚀 KozzyX Dashboard</h1>
            <p class="status">Bot Status: ONLINE</p>
            <a href="#" class="button">Login with Discord</a>
        </body>
        </html>
    `);
});

app.listen(port, () => {
    console.log(\`Dashboard server running at http://localhost:\${port}\`);
});
