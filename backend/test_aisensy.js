require('dotenv').config({ path: '../.env' });
const sqlite3 = require('sqlite3').verbose();

const db = new sqlite3.Database('database.sqlite', async (err) => {
    if (err) {
        console.error(err);
        return;
    }
    
    db.get(`
        SELECT DISTINCT c.* FROM contacts c 
        JOIN list_members lm ON c.id = lm.contact_id 
        WHERE lm.list_id = 12
        AND c.full_name IS NOT NULL AND c.full_name != '' 
        AND c.phone1 IS NOT NULL AND c.phone1 != '' 
        AND c.phone1_type = 'personal'
        LIMIT 1
    `, [], async (err, contact) => {
        if (err) {
            console.error(err);
            db.close();
            return;
        }
        if (!contact) {
            console.log('No contact found');
            db.close();
            return;
        }
        
        let phone = contact.phone1.replace(/\D/g, '');
        if (phone.length === 10) phone = '91' + phone;
        
        console.log('Testing 0 parameters (empty array)...');
        
        const payload = {
            apiKey: process.env.aisensy_api,
            campaignName: 'tasc_facts',
            destination: phone,
            userName: contact.full_name,
            templateParams: [],
            source: "Data Intelligence Hub",
            buttons: [],
            carouselCards: [],
            location: {},
            attributes: {
                "Designation": contact.current_position || "",
                "LinkedIn": contact.person_linkedin_url || "", 
                "Email": contact.email1 || "",
                "Company": contact.company_name || ""
            },
            paramsFallbackValue: {
                FirstName: "user"
            },
            media: {
                url: 'https://d3jt6ku4g6z5l8.cloudfront.net/IMAGE/6a0c4e9953aa50499dba3fb7/1635475_54976fb9ec354e23984ede7e629b4718%201.png',
                filename: "media_file"
            }
        };
        
        try {
            const response = await fetch('https://backend.aisensy.com/campaign/t1/api/v2', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });
            
            console.log('Response Status:', response.status);
            const data = await response.json();
            console.log('Response Body:', JSON.stringify(data, null, 2));
        } catch (e) {
            console.error(e);
        } finally {
            db.close();
        }
    });
});
