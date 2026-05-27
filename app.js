require('dotenv').config(); // phải là dòng ĐẦU TIÊN trước mọi require khác

const express = require('express');
const path = require('path');
const { Pool } = require('pg');
const session = require('express-session');
const ConnectPgSimple = require('connect-pg-simple')(session);
const { t } = require('./config/i18n');

const app = express();

// ── View engine ───────────────────────────────────────────────────────────────
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// ── Static assets ─────────────────────────────────────────────────────────────
app.use(express.static(path.join(__dirname, 'public')));

// ── Body parsing ──────────────────────────────────────────────────────────────
app.use(express.json());
app.use(express.urlencoded({ extended: false }));

// ── Session (lưu vào Postgres Supabase, không mất khi restart) ────────────────
// Tạo Pool riêng với SSL — cần thiết cho Supabase Postgres
const pgPool = new Pool({
  connectionString: process.env.SUPABASE_DB_URL,
  ssl: { rejectUnauthorized: false },
});

app.use(session({
  store: new ConnectPgSimple({
    pool: pgPool,
    tableName: 'session',
    createTableIfMissing: true,
  }),
  secret: process.env.SESSION_SECRET,
  resave: false,
  saveUninitialized: false,
  cookie: {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    maxAge: 7 * 24 * 60 * 60 * 1000, // 7 ngày
    sameSite: 'lax',
  },
}));

// ── res.locals: user + i18n vào mọi EJS template tự động ─────────────────────
app.use((req, res, next) => {
  const lang = req.session.lang || 'vi';
  req.t = (key, vars) => t(lang, key, vars);
  res.locals.user = req.session.user || null;
  res.locals.lang  = lang;
  res.locals.t     = req.t;
  next();
});

// ── Routes ────────────────────────────────────────────────────────────────────
app.use('/', require('./routes/lang'));
app.use('/', require('./routes/index'));
app.use('/', require('./routes/auth'));
app.use('/', require('./routes/dashboard'));
app.use('/', require('./routes/profile'));

// ── 404 ───────────────────────────────────────────────────────────────────────
app.use((_req, res) => res.status(404).render('404', { title: '404 | Kizuna Nihongo' }));

module.exports = app;
