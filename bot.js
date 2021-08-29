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

const all_dept_channel_ids = ["878142767342190612", "878142316555165736", "878142356170346527", "878142874485686303", "878142269771882527",
"878142826804813855", "878143102139908146", "878143010674724924", "878143066379288596", "878143135283314739"];
// temporary, will actually pull from the database later


// get all records in both databases with the "NEED BOT TO UPDATE" property checked 
// -> update channel permissions and add roles as necessary -> uncheck
setInterval(update_users, 5000, notion, notion_utils.students_id, "Students");
setInterval(update_users, 5000, notion, notion_utils.instructors_id, "Instructors");


// user_type is either "Instructors" or "Students"
async function update_users(notion, database_id, user_type) {
		all_courses = notion_utils.get_records(notion, notion_utils.courses_id);

		if(user_type == "Students") {
			checkboxes = { 
	  	"property": "NEED BOT TO UPDATE",
		  "checkbox": {
		    "equals": true
				  }
			  }
		}
		else {
			checkboxes = {
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
		};

		// only records with the "NEED BOT TO UPDATE" box checked (and "Approved" for instructors) are retrieved
		records_to_be_updated = notion_utils.get_records(notion, database_id, checkboxes);

		ready_to_update_promise = Promise.all([all_courses, records_to_be_updated]);

		ready_to_update_promise.then(response => {
			update_perms_and_roles(response[0], response[1], database_id, user_type);

			// uncheck
			for (user of response[1].results) {
			notion_utils.update_record(notion, user.id, 
			{
				"NEED BOT TO UPDATE" : {
					checkbox: false
				}
			});
		}; 
	});
}; 


async function update_perms_and_roles(all_courses, response, database_id, user_type) {
	for (user of response.results) {

		// address the following cases:
		// 1. no id, invalid username (shouldn't happen, but you should handle anyway by replacing the username with "NEEDS TO BE UPDATED" or smth)
		// 2. no id, valid username (just grab using username)
		// 3. valid id, invalid username (grab username)

		user_id = user.properties['Discord ID'].rich_text[0].plain_text;

		// addresses the case where the user is also in the other database by extending channel_ids 
		// (the channels that they should be in as a user_type) with
		// the other channels that they should be in
		if(user_type == "Students") {
			other_id = notion_utils.instructors_id;
			perms = { VIEW_CHANNEL: true, SEND_MESSAGES : true};
			role = discord_utils.enrolled_id;
		}
		else {
			other_id = notion_utils.students_id;
			perms = { VIEW_CHANNEL: true, SEND_MESSAGES : true, MANAGE_MESSAGES : true};
			role = discord_utils.teacher_id;
		};

		// won't return anything if the user doesn't have a record in the other database
		other_record = notion_utils.get_records(notion, other_id, 
		{ 
  	"property": "Discord ID",
	  "text": {
	    "equals": user_id
			  }
		  }
		);
		other_record.then(async function handle_other(other_record) {

			user_id = user.properties['Discord ID'].rich_text[0].plain_text;
			if(other_record.results.length == 1) {
				p1 = get_channels_to_be_in(user, user_type, other_record=other_record);
				p2 = get_all_channels(all_courses);
				lists_ready = Promise.all([p1, p2]);
			}
			else
			{
				p1 = get_channels_to_be_in(user, user_type);
				p2 = get_all_channels(all_courses);
				lists_ready = Promise.all([p1, p2]);
			};

			lists_ready.then(arr => {
				channel_ids = arr[0];
				all_courses_ids = arr[1];

				discord_utils.update_channel_perms(client, user_id, channel_ids, all_courses_ids, perms);
				discord_utils.check_for_role(client, user_id, role).then((has_role) => {
					if(!has_role) { // checking for role first
							discord_utils.add_role(client, user_id, role); 
					};
				});
				username = discord_utils.get_user_from_id(client, user_id);
				username.then(str => discord_utils.send_message_to_channel(`Successfully updated ${str}`)); // temporary
			});
		});
	};
};

async function get_channels_to_be_in(user, user_type, other_record=undefined) {
	get_channels_to_be_in.channel_ids = [];
	for (channel_id of user.properties['Course Channel IDs (Test)'].rollup.array) { 
		get_channels_to_be_in.channel_ids.push(channel_id.text[0].plain_text);
	};

	filter = {
		"or": [
		]
	};


	// get dept ids here
	if(user_type == "Instructors") {

		for (channel_id of user.properties['Course Channel IDs (Test)'].rollup.array) { 
			filter["or"].push({
				"property" : "Channel ID",
				"text" : {
					"contains" : channel_id.text[0].plain_text
				}
			});
		};

		courses_in = notion_utils.get_records(notion, notion_utils.courses_id, filter=filter);
		return_list = courses_in.then(courses_in => {
			dept_channel_ids = new Set();
			for(course of courses_in.results) {
				for(dept_id of course.properties["Department Channel IDs"].rollup.array) {
					dept_channel_ids.add(dept_id.text[0].plain_text);
				};
			};

			dept_channel_ids = Array.from(dept_channel_ids);
			
			get_channels_to_be_in.channel_ids.push(...dept_channel_ids);

			if (typeof other_record !== 'undefined') { // add student channel ids here
				student_channels = [];
				for(ch_id of other_record.results[0].properties['Course Channel IDs (Test)'].rollup.array) {
					student_channels.push(ch_id.text[0].plain_text);
				};
				get_channels_to_be_in.channel_ids.push(...student_channels);
			};
			return get_channels_to_be_in.channel_ids;
		});
		return return_list;
	};

	if(user_type == "Students" && typeof other_record !== 'undefined') {
		instructor_channels = []
		for(ch_id of other_record.results[0].properties['Course Channel IDs (Test)'].rollup.array) {
			instructor_channels.push(ch_id.text[0].plain_text);
		};
		get_channels_to_be_in.channel_ids.push(...instructor_channels);

		// also get dept ids here
		for (channel_id of other_record.results[0].properties['Course Channel IDs (Test)'].rollup.array) { 
			filter["or"].push({
				"property" : "Channel ID",
				"text" : {
					"contains" : channel_id.text[0].plain_text
				}
			});
		};

		courses_in = notion_utils.get_records(notion, notion_utils.courses_id, filter=filter);
		return_list = courses_in.then(courses_in => {
			dept_channel_ids = new Set();
			for(course of courses_in.results) {
				for(dept_id of course.properties["Department Channel IDs"].rollup.array) {
					dept_channel_ids.add(dept_id.text[0].plain_text);
				};
			};

			dept_channel_ids = Array.from(dept_channel_ids);


			get_channels_to_be_in.channel_ids.push(...dept_channel_ids);
			return get_channels_to_be_in.channel_ids;
		});

		return return_list;

	} 
	else if (user_type == "Students"){
		courses_in = notion_utils.get_records(notion, notion_utils.courses_id, filter=filter);
		return_list = courses_in.then(courses_in => { // can't have a plain return statement, so have to use some kind of promise
			return get_channels_to_be_in.channel_ids;
		});
		return return_list;


	};
};


async function get_all_channels(all_courses) {

	all_courses_ids = []; // an arr containing the ids of all of our courses
	for (course of all_courses.results) {
		all_courses_ids.push(course.properties['Channel ID'].rich_text[0].plain_text);
	};
	
	all_courses_ids.push(...all_dept_channel_ids);

	return all_courses_ids
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