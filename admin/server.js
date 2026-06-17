const express = require('express');
const path = require('path');
const app = express();
const PORT = process.env.PORT || 3001;

// Get current directory
const currentDir = process.cwd();

// Serve static files from admin/web directory
app.use(express.static(path.join(currentDir, 'admin', 'web')));

// Serve the admin panel at root
app.get('/', (req, res) => {
    res.sendFile(path.join(currentDir, 'admin', 'web', 'index.html'));
});

// Handle all other routes by serving the admin panel (SPA behavior)
app.get('*', (req, res) => {
    res.sendFile(path.join(currentDir, 'admin', 'web', 'index.html'));
});

app.listen(PORT, () => {
    console.log(`Admin Panel Server running at http://localhost:${PORT}`);
    console.log('Login credentials: admin@rideapp.com / admin123');
});