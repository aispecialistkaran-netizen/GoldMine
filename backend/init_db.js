const sqlite3 = require('sqlite3').verbose();
const fs = require('fs');
const csv = require('csv-parser');

const db = new sqlite3.Database('database.sqlite');
const csvFilePath = '../merged_output.csv';

console.log("Starting DB initialization...");

db.serialize(() => {
    db.run("DROP TABLE IF EXISTS contacts");
    db.run(`CREATE TABLE contacts (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        full_name TEXT,
        email1 TEXT, email1_type TEXT, email1_status TEXT,
        email2 TEXT, email2_type TEXT, email2_status TEXT,
        email3 TEXT, email3_type TEXT, email3_status TEXT,
        email4 TEXT, email4_type TEXT, email4_status TEXT,
        phone1 TEXT, phone1_type TEXT, phone1_status TEXT,
        current_position TEXT,
        company_name TEXT,
        person_city TEXT,
        person_country TEXT,
        person_industry TEXT,
        person_image_url TEXT
    )`);
    
    db.run("CREATE INDEX idx_name ON contacts(full_name)");
    db.run("CREATE INDEX idx_company ON contacts(company_name)");
    db.run("CREATE INDEX idx_industry ON contacts(person_industry)");
    db.run("CREATE INDEX idx_country ON contacts(person_country)");

    console.log("Reading CSV and inserting rows...");
    
    db.run("PRAGMA synchronous = OFF");
    db.run("PRAGMA journal_mode = MEMORY");
    
    const stmt = db.prepare(`INSERT INTO contacts (
        full_name, email1, email1_type, email1_status, email2, email2_type, email2_status,
        email3, email3_type, email3_status, email4, email4_type, email4_status,
        phone1, phone1_type, phone1_status, current_position, company_name, 
        person_city, person_country, person_industry, person_image_url
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`);

    let count = 0;
    let pending = 0;
    
    db.run("BEGIN TRANSACTION");
    
    const stream = fs.createReadStream(csvFilePath).pipe(csv());
    
    stream.on('data', (row) => {
        pending++;
        stmt.run([
            row.full_name || null,
            row.email1 || null, row.email1_type || null, row.email1_status || null,
            row.email2 || null, row.email2_type || null, row.email2_status || null,
            row.email3 || null, row.email3_type || null, row.email3_status || null,
            row.email4 || null, row.email4_type || null, row.email4_status || null,
            row.phone1 || null, row.phone1_type || null, row.phone1_status || null,
            row.current_position || null,
            row.company_name || null,
            row.person_city || null,
            row.person_country || null,
            row.person_industry || null,
            row.person_image_url || null
        ], (err) => {
            if (err) console.error(err);
            pending--;
            if (pending === 0 && stream.isPaused()) stream.resume();
        });

        count++;
        if (count % 50000 === 0) console.log(`Inserted ${count} rows...`);
        if (pending > 1000) stream.pause();
    })
    .on('end', () => {
        const checkDone = setInterval(() => {
            if (pending === 0) {
                clearInterval(checkDone);
                stmt.finalize();
                db.run("COMMIT", () => {
                    console.log(`Finished inserting all ${count} rows! Database is ready.`);
                    db.close();
                });
            }
        }, 100);
    });
});
