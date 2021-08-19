const { Client : DiscordClient, Collection, Intents, Guild, GuildMember, Permissions } = require('discord.js');
const { Client : NotionClient} = require("@notionhq/client");
const winston = require('winston'); // (error) logging!
const notion_utils = require('./notion_utils');
const discord_utils = require('./discord_utils')
const fs = require('fs');
require('dotenv').config();

const notion = new NotionClient({
  auth: process.env.notion_key,
});

const client = new DiscordClient({ intents: [Intents.FLAGS.GUILDS] });
client.login(process.env.token);


// get all records in "Students" with the "NEED BOT TO UPDATE" property checked -> update channel permissions and add roles as necessary -> uncheck
setInterval(update_students, 5000, notion, notion_utils.students_id); 


async function update_students(notion, database_id)
{
	r = notion_utils.get_records(notion, notion_utils.students_id, 
			{ // only records with the "NEED BOT TO UPDATE" box checked should be retrieved
  	"property": "NEED BOT TO UPDATE",
	  "checkbox": {
	    "equals": true
			  }
		  }
		);
	r.then(response => update_student_perms_and_roles(response));
	// uncheck here w/ notion_utils.update_record();
}


async function update_student_perms_and_roles(response) {
	console.log(discord_utils.bt5);
}

/*
notes:
- a page is a type of block that can contain other blocks
- databases contain pages (referred to as records here)
*/