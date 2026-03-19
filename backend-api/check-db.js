const db = require('./src/config/db');

(async () => {
  try {
    const result = await db.query('SELECT * FROM information_schema.columns WHERE table_name = \'ingredient\' ORDER BY ordinal_position');
    console.log('=== INGREDIENT TABLE COLUMNS ===');
    result.rows.forEach(col => {
      console.log(`  ${col.column_name}: ${col.data_type}${col.is_nullable === 'NO' ? ' NOT NULL' : ''}`);
    });
    
    const countResult = await db.query('SELECT COUNT(*) as cnt FROM ingredient');
    console.log(`\nTotal ingredients in DB: ${countResult.rows[0].cnt}`);
    
    const statusResult = await db.query('SELECT DISTINCT status FROM ingredient');
    console.log('Status values:', statusResult.rows.map(r => r.status || 'NULL').join(', '));

    const sampleResult = await db.query('SELECT ingredient_id, name, type, status FROM ingredient LIMIT 3');
    console.log('\nSample ingredients:');
    sampleResult.rows.forEach(row => {
      console.log(`  ID ${row.ingredient_id}: ${row.name} (${row.type}) [${row.status}]`);
    });
  } catch (e) {
    console.error('Error:', e.message);
  } finally {
    process.exit(0);
  }
})();
