require("dotenv").config({ override: true });
const net   = require("net");
const mysql = require("mysql2/promise");

const HOST = process.env.DB_HOST || "127.0.0.1";
const PORT = Number(process.env.DB_PORT) || 3306;

const pool = mysql.createPool({
  user              : process.env.DB_USER     || "studylink_user",
  password          : process.env.DB_PASSWORD || "studylink_pass",
  database          : process.env.DB_NAME     || "studylink",
  waitForConnections: true,
  connectionLimit   : 10,
  stream: () => net.createConnection({ host: HOST, port: PORT, family: 4 }),
});

pool.pool.on("error", () => {});

async function waitForDB(retries = 10, delay = 2000) {
  for (let i = 1; i <= retries; i++) {
    try {
      const conn = await pool.getConnection();
      conn.release();
      console.log(" MySQL connected");
      return;
    } catch (err) {
      console.log(`⏳  Attempt ${i}/${retries}: ${err.message}`);
      if (i === retries) { console.error("Cannot reach MySQL."); process.exit(1); }
      await new Promise(r => setTimeout(r, delay));
    }
  }
}

waitForDB();
module.exports = pool;
