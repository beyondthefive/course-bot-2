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
	r.then(response => {
		update_student_perms_and_roles(response);

		// uncheck
		for (student of response.results) {
		notion_utils.update_record(notion, student.id, 
		{
			"NEED BOT TO UPDATE" : {
				checkbox: false
			}
		});
	}; 
	});
};


async function update_student_perms_and_roles(response) {
	for (student of response.results) {

		student_id = student.properties['Discord ID'].rich_text[0].plain_text

		var channel_ids = []; // channel IDs
		// since the channel IDs in the Students database are from the Courses database, we have to grab the channel IDs from that database
		for (c of student.properties['Courses'].relation) { 
			r = notion_utils.get_record(notion, c.id);
			r.then(response => channel_ids.push(response.properties['Channel ID'].rich_text[0].plain_text));
		};

		discord_utils.update_channel_perms(client, student_id, channel_ids, { VIEW_CHANNEL: true, SEND_MESSAGES : true});
		discord_utils.add_role(client, student_id, "new role"); // change to "Enrolled" before actually deploying
	};
}

/*
notes:
- a page is a type of block that can contain other blocks
- databases contain pages (referred to as records here)
- "short bursts" of requests are allowed by the api -> tried 25-ish req/second for 5-ish seconds, seemed fine
- to change before deploying:
	- change all instances of "new role" to "Enrolled"
	- update guild_id in discord_utils
*/