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
setInterval(update_instructors, 5000, notion, notion_utils.instructors_id); 

async function update_students(notion)
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
		student_id = student.properties['Discord ID'].rich_text[0].plain_text

		// addresses the case where the student is also an instructor by extending channel_ids (the channels that they should be in as a student)
		// with the channels that they should be in as an instructor
		instructor = notion_utils.get_records(notion, notion_utils.instructors_id, 
		{ 
  	"property": "Discord ID",
	  "text": {
	    "equals": student_id
			  }
		  }
		);
		
		instructor.then(instructor => {

			student_id = student.properties['Discord ID'].rich_text[0].plain_text

			channel_ids = []
			for (channel_id of student.properties['Course Channel IDs (Test)'].rollup.array) {
				channel_ids.push(channel_id.text[0].plain_text);
			};
	
			all_courses_ids = []; // an arr containing the ids of all of our courses
			for (course of all_courses.results) {
				all_courses_ids.push(course.properties['Channel ID'].rich_text[0].plain_text);
			};

			if(instructor.results.length == 1) {
					instructor_channels = []
					for(ch_id of instructor.results[0].properties['Course Channel IDs (Test)'].rollup.array) {
						instructor_channels.push(ch_id.text[0].plain_text);
					}
					channel_ids.push(...instructor_channels);
			}

			discord_utils.update_channel_perms(client, student_id, channel_ids, all_courses_ids, { VIEW_CHANNEL: true, SEND_MESSAGES : true});
			discord_utils.check_for_role(client, student_id, discord_utils.enrolled_id).then((has_role) => {
				if(!has_role) { // checking for role first
				discord_utils.add_role(client, student_id, discord_utils.enrolled_id); 
				};
			});


			username = discord_utils.get_user_from_id(client, student_id);
			username.then(str => console.log(`Successfully updated student ${str}`)); // temporary

		});
	};
}



async function update_instructors(notion)
{

	all_courses = notion_utils.get_records(notion, notion_utils.courses_id);

	records_to_be_updated = notion_utils.get_records(notion, notion_utils.instructors_id, 
			{
  "and": [
    {
      "property": "NEED BOT TO UPDATE",
      "checkbox": {
        "equals": true
      }
    },
    {
      "property": "Approved",
      "checkbox": {
        "equals": true
      }
    }
  			]
			}
		);


	ready_to_update_promise = Promise.all([all_courses, records_to_be_updated]);

	ready_to_update_promise.then(response => {
		update_instructor_perms_and_roles(response[0], response[1]);

		// uncheck
		for (instructor of response[1].results) {
		notion_utils.update_record(notion, instructor.id, 
		{
			"NEED BOT TO UPDATE" : {
				checkbox: false
			}
		});
	}; 
	});
};

async function update_instructor_perms_and_roles(all_courses, response) {
	for (instructor of response.results) {
		instructor_id = instructor.properties['Discord ID'].rich_text[0].plain_text;

		student = notion_utils.get_records(notion, notion_utils.students_id, 
		{ 
  	"property": "Discord ID",
	  "text": {
	    "equals": instructor_id
			  }
		  }
		);

		student.then(student => {
			// address the following cases:
			// 1. no id, invalid username (shouldn't happen, but you should handle anyway by replacing the username with "NEEDS TO BE UPDATED" or smth)
			// 2. no id, valid username (just grab using username)
			// 3. valid id, invalid username (grab username)

			channel_ids = []
			for (channel_id of instructor.properties['Course Channel IDs (Test)'].rollup.array) {
				channel_ids.push(channel_id.text[0].plain_text);
			};
	
			all_courses_ids = []; // an arr containing the ids of all of our courses
			for (course of all_courses.results) {
				all_courses_ids.push(course.properties['Channel ID'].rich_text[0].plain_text);
			};

			if(student.results.length == 1) {
					student_channels = []
					for(ch_id of student.results[0].properties['Course Channel IDs (Test)'].rollup.array) {
						student_channels.push(ch_id.text[0].plain_text);
					}
					channel_ids.push(...student_channels);
			}
			

			discord_utils.update_channel_perms(client, instructor_id, channel_ids, all_courses_ids, { VIEW_CHANNEL: true, SEND_MESSAGES : true, MANAGE_MESSAGES : true});
			discord_utils.check_for_role(client, instructor_id, discord_utils.teacher_id).then((has_role) => {
				if(!has_role) { // checking for role first
				discord_utils.add_role(client, instructor_id, discord_utils.teacher_id); 
				};
			});
			username = discord_utils.get_user_from_id(client, instructor_id);
			username.then(str => console.log(`Successfully updated instructor ${str}`)); // temporary


		});
			

	};
	
};



/*
notes:
- a page is a type of block that can contain other blocks
- databases contain pages (referred to as records here)
- "short bursts" of requests are allowed by the api -> tried 25-ish req/second for 5-ish seconds, seemed fine
- to change before deploying:
	- update guild_id in discord_utils
	- update enrolled_id in discord_utils
	- Courses (Test) + Courses page ID + Course Channel IDs (Test) (not changed yet)
	- change any other IDs/property names/etc that you forgot abt
	- remove all test properties from notion
- TODO:
	- add logging and error handling + other QOL additions
	- optimize
	- combine the two sets of async functions into one set (or not, idk)
*/