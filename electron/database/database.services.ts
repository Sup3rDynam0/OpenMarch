import { app, ipcMain } from 'electron';
import Database from 'better-sqlite3';
import path from 'path';
import { Constants } from '../../src/Constants';
import * as Interfaces from '../../src/Interfaces';

/* ============================ DATABASE ============================ */
function connect() {
    try {
        return Database(
            path.resolve(__dirname, '../../','electron/database/', 'database.db'),
            { verbose: console.log },
        );
    } catch (error) {
        throw new Error('Failed to connect to database:\
        PLEASE RUN \'node_modules/.bin/electron-rebuild -f -w better-sqlite3\' to resolve this', error);
    }
}

export function createDatabase() {
    const db = connect();
    console.log(db);
    console.log('Creating database...');
    if(!db) return;
    createMarcherTable(db);
    createPageTable(db);
    createMarcherPageTable(db);
    console.log('Database created.');
    db.close();
}

function createMarcherTable(db: Database.Database) {
    console.log('Creating marcher table...');
    try {
        db.exec(`
            CREATE TABLE IF NOT EXISTS "marchers" (
                "id"	INTEGER NOT NULL UNIQUE,
                "id_for_html"	TEXT UNIQUE,
                "name"	TEXT,
                "section"	TEXT NOT NULL,
                "year"	INTEGER,
                "notes"	TEXT,
                "drill_prefix"	TEXT NOT NULL,
                "drill_order"	INTEGER NOT NULL,
                "drill_number"	TEXT UNIQUE NOT NULL,
                "created_at"	TEXT NOT NULL,
                "updated_at"	TEXT NOT NULL,
                PRIMARY KEY("id" AUTOINCREMENT)
            );
        `);
    } catch (error) {
        console.error('Failed to create marcher table:', error);
    }
    console.log('Marcher table created.');
}

function createPageTable(db: Database.Database) {
    db.exec(`
        CREATE TABLE IF NOT EXISTS "pages" (
            "id"	INTEGER NOT NULL UNIQUE,
            "id_for_html"	TEXT UNIQUE,
            "name"	TEXT NOT NULL UNIQUE,
            "notes"	TEXT,
            "order"	INTEGER NOT NULL UNIQUE,
            "tempo"	REAL NOT NULL,
            "time_signature"	TEXT,
            "counts"	INTEGER NOT NULL,
            "created_at"	TEXT NOT NULL,
            "updated_at"	TEXT NOT NULL,
            PRIMARY KEY("id" AUTOINCREMENT)
        );
    `);
}

function createMarcherPageTable(db: Database.Database) {
    db.exec(`
        CREATE TABLE IF NOT EXISTS "marcher_pages" (
            "id" INTEGER NOT NULL UNIQUE,
            "id_for_html" TEXT UNIQUE,
            "marcher_id" INTEGER NOT NULL,
            "page_id" INTEGER NOT NULL,
            "x" REAL,
            "y" REAL,
            "created_at" TEXT NOT NULL,
            "updated_at" TEXT NOT NULL,
            "notes" TEXT,
            PRIMARY KEY("id" AUTOINCREMENT)
        );
        CREATE INDEX IF NOT EXISTS "index_marcher_pages_on_marcher_id" ON "marcher_pages" ("marcher_id");
        CREATE INDEX IF NOT EXISTS "index_marcher_pages_on_page_id" ON "marcher_pages" ("page_id");
    `);
}

// export function init() {
//     ipcMain.handle('database', async (event, query, ...params) => {
//         const db = connect();
//         const stmt = db.prepare(query);
//         const result = stmt.all(...params);
//         db.close();
//         return result;
//     });
// }

export function initHandlers() {
    // Marcher
    ipcMain.handle('marcher:getAll', async (event, ...args) => getMarchers());
    ipcMain.handle('marcher:insert', async (event, ...args) => createMarcher(args));
    ipcMain.handle('marcher:update', async (event, args) => updateMarcher(args));
    ipcMain.handle('marcher:delete', async (event, marcher_id) => deleteMarcher(marcher_id));

    // Page
    ipcMain.handle('page:getAll', async (event, ...args) => getPages());
    ipcMain.handle('page:insert', async (event, ...args) => createPage(args));
    ipcMain.handle('page:update', async (event, args) => updatePage(args));
}

/* ============================ Marcher ============================ */
async function getMarchers() {
    const db = connect();
    const stmt = db.prepare(`SELECT * FROM ${Constants.MarcherTableName}`);
    const result = stmt.all();
    db.close();
    return result;
}

async function createMarcher(newMarchers: Interfaces.NewMarcher[]) {
    const newMarcher = newMarchers[0];
    const marcherToAdd: Interfaces.Marcher = {
        id: 0, // Not used, needed for interface
        id_for_html: '', // Not used, needed for interface
        name: newMarcher.name || '',
        section: newMarcher.section,
        drill_number: newMarcher.drill_prefix + newMarcher.drill_order,
        drill_prefix: newMarcher.drill_prefix,
        drill_order: newMarcher.drill_order
    };
    const db = connect();
    const insertStmt = db.prepare(`
        INSERT INTO ${Constants.MarcherTableName} (
            name,
            section,
            drill_prefix,
            drill_order,
            drill_number,
            created_at,
            updated_at
        ) VALUES (
            @name,
            @section,
            @drill_prefix,
            @drill_order,
            @drill_number,
            @created_at,
            @updated_at
        )
    `);
    const created_at = new Date().toISOString();
    const insertResult = insertStmt.run({
        ...marcherToAdd,
        created_at,
        updated_at: created_at
    });

    // Get the id of the inserted row
    const id = insertResult.lastInsertRowid;

    // Update the id_for_html field
    const updateStmt = db.prepare(`
        UPDATE ${Constants.MarcherTableName}
        SET id_for_html = @id_for_html
        WHERE id = @id
    `);
    const updateResult = updateStmt.run({
        id_for_html: Constants.MarcherPrefix + "_" + id,
        id
    });
    db.close();
    return updateResult;
}

/**
 * Updates a marcher with the given values.
 *
 * @param marcher_id: number - The id of the marcher to update
 * @param args: obj {} - The values to update the marcher with
 * @returns
 */
async function updateMarcher(args: Partial<Interfaces.Marcher> & {id: number}) {
    const db = connect();

    // List of properties to exclude
    const excludedProperties = ['id', 'id_for_html', 'drill_number', 'created_at', 'updated_at'];

    // Generate the SET clause of the SQL query
    let setClause = Object.keys(args)
        .filter(key => !excludedProperties.includes(key))
        .map(key => `${key} = @${key}`)
        .join(', ');

    // Check if the SET clause is empty
    if (setClause.length === 0) {
        throw new Error('No valid properties to update');
    }

    if(args.drill_prefix || args.drill_order) {
        setClause += ', drill_number = @drill_prefix || @drill_order';
    }

    console.log("setClause:", setClause);

    const stmt = db.prepare(`
        UPDATE ${Constants.MarcherTableName}
        SET ${setClause}, updated_at = @new_updated_at
        WHERE id = @id
    `);

    console.log("stmt:", stmt);

    const result = stmt.run({ ...args,  new_updated_at: new Date().toISOString()});
    db.close();
    return result;
}

async function deleteMarcher(marcher_id: number) {
    const db = connect();
    const stmt = db.prepare(`
        DELETE FROM ${Constants.MarcherTableName}
        WHERE id = @marcher_id
    `);
    const result = stmt.run({ marcher_id });
    db.close();
    return result;
}

/* ============================ Page ============================ */
async function getPages() {
    const db = connect();
    const stmt = db.prepare(`SELECT * FROM ${Constants.PageTableName}`);
    const result = stmt.all();
    db.close();
    return result;
}

async function createPage(newPages: Interfaces.NewPage[]) {
    const newPage = newPages[0];
    const db = connect();

    // Get the max order
    const stmt = db.prepare(`SELECT MAX("order") as maxOrder FROM ${Constants.PageTableName}`);
    const result: any = stmt.get();
    const newOrder = result.maxOrder + 1;
    const pageToAdd: Interfaces.Page = {
        id: 0, // Not used, needed for interface
        id_for_html: '', // Not used, needed for interface
        name: newPage.name || '',
        notes: newPage.notes || '',
        order: newOrder,
        tempo: newPage.tempo,
        time_signature: newPage.time_signature,
        counts: newPage.counts
    };
    const insertStmt = db.prepare(`
        INSERT INTO ${Constants.PageTableName} (
            name,
            notes,
            "order",
            tempo,
            time_signature,
            counts,
            created_at,
            updated_at
        ) VALUES (
            @name,
            @notes,
            @order,
            @tempo,
            @time_signature,
            @counts,
            @created_at,
            @updated_at
        )
    `);
    const created_at = new Date().toISOString();
    const insertResult = insertStmt.run({
        ...pageToAdd,
        created_at,
        updated_at: created_at
    });
    // Get the id of the inserted row
    const id = insertResult.lastInsertRowid;
    // Update the id_for_html field
    const updateStmt = db.prepare(`
        UPDATE ${Constants.PageTableName}
        SET id_for_html = @id_for_html
        WHERE id = @id
    `);
    const updateResult = updateStmt.run({
        id_for_html: Constants.PagePrefix + '_' + id,
        id
    });
}

async function updatePage(args: Partial<Interfaces.Page> & {id: number}) {
    const db = connect();

    // List of properties to exclude
    const excludedProperties = ['id', 'id_for_html', 'order', 'created_at', 'updated_at'];

    // Generate the SET clause of the SQL query
    let setClause = Object.keys(args)
        .filter(key => !excludedProperties.includes(key))
        .map(key => `${key} = @${key}`)
        .join(', ');

    // Check if the SET clause is empty
    if (setClause.length === 0) {
        throw new Error('No valid properties to update');
    }

    console.log("setClause:", setClause);

    const stmt = db.prepare(`
        UPDATE ${Constants.PageTableName}
        SET ${setClause}, updated_at = @new_updated_at
        WHERE id = @id
    `);

    console.log("stmt:", stmt);

    const result = stmt.run({ ...args,  new_updated_at: new Date().toISOString()});
    db.close();
    return result;
}


