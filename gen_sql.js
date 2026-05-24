const XLSX = require('xlsx');

async function run() {
  const wb = XLSX.readFile('../MFT l New Lead 16 Apri.xlsx');
  const rows = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]]);
  
  const standardKeys = ['date','Date','what_services_do_you_need?_','services_needed','Services Needed','industry_type_','industry_type','Industry','which_time_do_you_prefer?','preferred_time','Preferred Time','name_of_page_','page_name','Page Name','full name','full_name','Full Name','email','Email','phone_number','Phone','job_title','Job Title','Status','status','Marketing Budget/Month (Optional)','marketing_budget_monthly'];

  let sql = 'INSERT INTO public.lead_notes (lead_id, author_id, author_name, content, note_type) VALUES\n';
  let values = [];

  for(const r of rows) {
    const fn = r['full name'] || r['full_name'] || r['Full Name'];
    const email = r['email'] || r['Email'];
    const phone = r['phone_number'] || r['Phone'];
    if(!fn) continue;
    
    Object.entries(r).forEach(([k, value]) => {
      if(!standardKeys.includes(k) && value) {
        // Find lead_id via subquery
        const subquery = `(SELECT id FROM public.leads WHERE full_name = '${fn.replace(/'/g, "''")}' LIMIT 1)`;
        const content = String(value).replace(/'/g, "''");
        const author = k.replace(/'/g, "''");
        values.push(`(${subquery}, '00000000-0000-0000-0000-000000000000', '${author}', '${content}', 'reply')`);
      }
    });
  }
  
  if(values.length > 0) {
    sql += values.join(',\n') + ';';
    // Remove the whole row if lead_id subquery returns null (fails to find)
    // Actually we can just do this in SQL: if subquery returns null, the insert will fail if lead_id is not null, which it is. 
    // To be safe, we only insert where lead exists. 
    // But since it's an insert values, if one row fails, everything fails. 
    // Let's filter out null lead_ids by using INSERT INTO ... SELECT
    
    let selectSql = 'INSERT INTO public.lead_notes (lead_id, author_id, author_name, content, note_type)\nSELECT * FROM (\n  VALUES\n';
    selectSql += values.map(v => `  ${v}`).join(',\n');
    selectSql += '\n) AS t(lead_id, author_id, author_name, content, note_type)\nWHERE lead_id IS NOT NULL;';

    const fs = require('fs');
    fs.writeFileSync('insert_notes.sql', selectSql);
    console.log('Generated insert_notes.sql with', values.length, 'notes');
  } else {
    console.log('No notes found');
  }
}
run();
