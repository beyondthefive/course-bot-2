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
client.once('ready', () => {
	console.log('Ready!');
});
client.login(process.env.token);


// get all records in "Students" with the "NEED BOT TO UPDATE" property checked -> update channel permissions and add roles as necessary -> uncheck
setInterval(update_students, 5000, notion, notion_utils.students_id); 


async function update_students(notion, database_id)
{

	all_courses = notion_utils.get_records(notion, notion_utils.courses_id);

	records_to_be_updated = notion_utils.get_records(notion, notion_utils.students_id, 
			{ // only records with the "NEED BOT TO UPDATE" box checked should be retrieved
  	"property": "NEED BOT TO UPDATE",
	  "checkbox": {
	    "equals": true
			  }
		  }
		);

	ready_to_update_promise = Promise.all([all_courses, records_to_be_updated]);

	ready_to_update_promise.then(response => {
		update_student_perms_and_roles(response[0], response[1]);

		// uncheck
		for (student of response[1].results) {
		notion_utils.update_record(notion, student.id, 
		{
			"NEED BOT TO UPDATE" : {
				checkbox: false
			}
		});
	}; 
	});
};


async function update_student_perms_and_roles(all_courses, response) {
	for (student of response.results) {

		var channel_id_promises = []; 
		// since the channel IDs in the Students database are from the Courses database, we have to grab the channel IDs from that database
		for (c of student.properties['Courses (Test)'].relation) { 
			r = notion_utils.get_record(notion, c.id, student);
			channel_id_promises.push(r);
		};


		const all_channels_promise = Promise.all(channel_id_promises);
		all_channels_promise.then((response) => {

			student_id = response[0][1].properties['Discord ID'].rich_text[0].plain_text

			channel_ids = [];
			for(r of response) {
				channel_ids.push(r[0].properties['Channel ID'].rich_text[0].plain_text);
			};
	
			all_courses_ids = []; // an arr containing the ids of all of our courses
			for (course of all_courses.results) {
				all_courses_ids.push(course.properties['Channel ID'].rich_text[0].plain_text);
			};
			

			discord_utils.update_channel_perms(client, student_id, channel_ids, all_courses_ids, { VIEW_CHANNEL: true, SEND_MESSAGES : true});
			discord_utils.check_for_role(client, student_id, discord_utils.enrolled_id).then((has_role) => {
				if(!has_role) { // checking for role first
				discord_utils.add_role(client, student_id, discord_utils.enrolled_id); 
				};
			});
			console.log(`Successfully updated ${student_id}`); // temporary
			
		});

		
	};
}

/*
notes:
- a page is a type of block that can contain other blocks
- databases contain pages (referred to as records here)
- "short bursts" of requests are allowed by the api -> tried 25-ish req/second for 5-ish seconds, seemed fine
- to change before deploying:
	- update guild_id in discord_utils
	- update enrolled_id in discord_utils
	- Courses (Test) + Courses page ID + Course Channel IDs (Test) (not changed yet)
- TODO:
	- add logging and error handling + other QOL additions
	- optimize
*/