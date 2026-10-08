const express = require('express'); 
const sqlite3 = require('sqlite3').verbose(); 
const path = require('path'); 
const cors = require('cors'); 
 
const app = express(); 
const PORT = 3000; 

// --- SECURITY ---
const ADMIN_PASSWORD = 'admin123';

const authenticate = (req, res, next) => {
    const password = req.headers['x-admin-password'];
    if (!password || password !== ADMIN_PASSWORD) {
        return res.status(401).json({ error: "Access Denied: Incorrect Admin Password." });
    }
    next();
};
 
// Middleware 
app.use(express.json()); 
app.use(cors()); 
app.use(express.static(path.join(__dirname, 'public'))); 
 
// Initialize SQLite Database 
const db = new sqlite3.Database('./database.sqlite', (err) => { 
    if (err) {
        console.error("Database connection error:", err.message); 
    } else {
        console.log("Connected to SQLite database."); 
        db.run("PRAGMA foreign_keys = ON"); 
    }
}); 
 
// Create Tables 
db.serialize(() => { 
    db.run(`CREATE TABLE IF NOT EXISTS events ( 
        id INTEGER PRIMARY KEY AUTOINCREMENT, 
        name TEXT NOT NULL, 
        date TEXT NOT NULL, 
        venue TEXT NOT NULL, 
        capacity INTEGER NOT NULL 
    )`); 
 
    db.run(`CREATE TABLE IF NOT EXISTS attendees ( 
        id INTEGER PRIMARY KEY AUTOINCREMENT, 
        event_id INTEGER NOT NULL, 
        name TEXT NOT NULL, 
        email TEXT NOT NULL, 
        ticket_type TEXT NOT NULL, 
        FOREIGN KEY (event_id) REFERENCES events(id) ON DELETE CASCADE 
    )`); 
}); 
 
// --- API ENDPOINTS --- 
 
// PUBLIC: Anyone can add events
app.post('/api/events', (req, res) => { 
    const { name, date, venue, capacity } = req.body; 
    if (!name || !date || !venue || !capacity) return res.status(400).json({ error: "All fields are required" }); 
 
    db.run(`INSERT INTO events (name, date, venue, capacity) VALUES (?, ?, ?, ?)`,  
        [name, date, venue, capacity], function(err) { 
        if (err) return res.status(500).json({ error: err.message }); 
        res.status(201).json({ id: this.lastID, message: "Event created successfully!" }); 
    }); 
}); 
 
// PUBLIC: Anyone can view events
app.get('/api/events', (req, res) => { 
    db.all(`SELECT * FROM events`, [], (err, rows) => { 
        if (err) return res.status(500).json({ error: err.message }); 
        res.json(rows); 
    }); 
}); 
 
// PUBLIC: Anyone can register an attendee
app.post('/api/attendees', (req, res) => { 
    const { event_id, name, email, ticket_type } = req.body; 
    if (!event_id || !name || !email || !ticket_type) return res.status(400).json({ error: "All fields are required" }); 
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/; 
    if (!emailRegex.test(email)) return res.status(400).json({ error: "Invalid email format" }); 
 
    db.get(`SELECT capacity FROM events WHERE id = ?`, [event_id], (err, event) => { 
        if (err) return res.status(500).json({ error: err.message }); 
        if (!event) return res.status(404).json({ error: "Event not found" }); 
 
        db.get(`SELECT COUNT(*) as count FROM attendees WHERE event_id = ?`, [event_id], (err, row) => { 
            if (err) return res.status(500).json({ error: err.message });
            if (row.count >= event.capacity) return res.status(400).json({ error: "Registration failed: Event is full" }); 
 
            db.get(`SELECT id FROM attendees WHERE event_id = ? AND email = ?`, [event_id, email], (err, duplicate) => { 
                if (err) return res.status(500).json({ error: err.message });
                if (duplicate) return res.status(400).json({ error: "Registration failed: Email already registered for this event" }); 
 
                db.run(`INSERT INTO attendees (event_id, name, email, ticket_type) VALUES (?, ?, ?, ?)`,  
                    [event_id, name, email, ticket_type], function(err) { 
                    if (err) return res.status(500).json({ error: err.message }); 
                    res.status(201).json({ message: "Attendee registered successfully!" }); 
                }); 
            }); 
        }); 
    }); 
}); 
 
// PUBLIC: Anyone can view attendees
app.get('/api/attendees', (req, res) => { 
    const sql = `SELECT attendees.*, events.name AS event_name FROM attendees JOIN events ON attendees.event_id = events.id`; 
    db.all(sql, [], (err, rows) => { 
        if (err) return res.status(500).json({ error: err.message }); 
        res.json(rows); 
    }); 
}); 
 
// SECURE: Only Admin can delete events
app.delete('/api/events/:id', authenticate, (req, res) => { 
    db.run(`DELETE FROM events WHERE id = ?`, [req.params.id], function(err) { 
        if (err) return res.status(500).json({ error: err.message }); 
        res.json({ message: "Event and associated attendees deleted." }); 
    }); 
}); 
 
// SECURE: Only Admin can delete attendees
app.delete('/api/attendees/:id', authenticate, (req, res) => { 
    db.run(`DELETE FROM attendees WHERE id = ?`, [req.params.id], function(err) { 
        if (err) return res.status(500).json({ error: err.message }); 
        res.json({ message: "Attendee deleted." }); 
    }); 
}); 
 
app.listen(PORT, () => { 
    console.log(`Server is running on http://localhost:${PORT}`); 
});