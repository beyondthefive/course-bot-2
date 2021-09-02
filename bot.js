const { Client : DiscordClient, Collection, Intents, Guild, GuildMember, Permissions } = require('discord.js');
const { Client : NotionClient} = require("@notionhq/client");
const winston = require('winston'); // (error) logging!
const notion_utils = require('./notion_utils');
const discord_utils = require('./discord_utils');
const fs = require('fs');
require('dotenv').config();

const notion = new NotionClient({
  auth: process.env.notion_key,
});


const client = new DiscordClient({ intents: [Intents.FLAGS.GUILDS] });
client.once('ready', () => {
	console.log('Ready!');
	client.user.setActivity('beyondthefive.org', { type: 'WATCHING' });
});
client.login(process.env.token);

// get all records in both databases with the "NEED BOT TO UPDATE" property checked 
// -> update channel permissions and add roles as necessary -> uncheck
setInterval(update_users, 5000, notion, notion_utils.students_id, "Students");
setInterval(update_users, 5000, notion, notion_utils.instructors_id, "Instructors");


// user_type is either "Instructors" or "Students"
async function update_users(notion, database_id, user_type) {
		try {
		all_courses = notion_utils.get_records(notion, notion_utils.courses_id);

		if(user_type == "Students") {
			checkboxes = {
		  "and": [
		    {
		      "property": "NEED BOT TO UPDATE",
		      "checkbox": {
		        "equals": true
		      }
		    },
		    {
		      "property": "Application Status",
		      "select": {
		        "equals": "ACCEPTED"
		      }
		    }
		  			]
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
	}
	catch(err) {
		discord_utils.send_message_to_channel(client, discord_utils.log_channel_id, "Encountered Notion rate limit or timed out");
	};
}; 


async function update_perms_and_roles(all_courses, response, database_id, user_type) {
	for (user of response.results) {
		try {

		user_id = "Default Value";
		username = user.properties['Discord Username'].rich_text[0].plain_text;
		if(user.properties['Discord ID'].rich_text.length == 0 && user.properties['Valid Discord Username'].checkbox == true) {

			id = await discord_utils.get_id_from_user(client, username); // actually nvm just do the search and match in this function

			if(id == "Not Found") {
				discord_utils.send_message_to_channel(client, discord_utils.log_channel_id, `Invalid Discord Username ${username}, could not retrieve ID`);
				continue;
			}
			else {
				notion_utils.update_record(notion, user.id, {
				"Discord ID" : {
					rich_text: [
						{
							text: 
							{
								content: String(id),
								link: null
							},
							plain_text: String(id)
						}
					]
				}
			});
				user_id = id;
			};
		}
		else if (user.properties['Discord ID'].rich_text.length == 0) {
			discord_utils.send_message_to_channel(client, discord_utils.log_channel_id, `Invalid Discord Username ${username}, could not retrieve ID`);
			continue;
		};
		

		if(user_id == "Default Value") {
			user_id = user.properties['Discord ID'].rich_text[0].plain_text;
		}

		// addresses the case where the user is also in the other database by extending channel_ids 
		// (the channels that they should be in as a user_type) with
		// the other channels that they should be in
		if(user_type == "Students") {
			other_id = notion_utils.instructors_id;
			perms = { VIEW_CHANNEL: true, SEND_MESSAGES : true};
			other_perms = { VIEW_CHANNEL: true, SEND_MESSAGES : true, MANAGE_MESSAGES : true};
			role = discord_utils.enrolled_id;
		}
		else {
			other_id = notion_utils.students_id;
			perms = { VIEW_CHANNEL: true, SEND_MESSAGES : true, MANAGE_MESSAGES : true};
			other_perms = { VIEW_CHANNEL: true, SEND_MESSAGES : true};
			role = discord_utils.teacher_id;
		};

		// won't return anything if the user doesn't have a record in the other database
		other_record = notion_utils.get_records_with_other_data(notion, other_id, [user_id, perms, other_perms, role, user], 
		{ 
  	"property": "Discord ID",
	  "text": {
	    "equals": user_id
			  }
		  }
		);

		other_record.then(async function handle_other(res) {

			// hacky sol that i'll eventually clean up
			other_record = res[0];
			user_id = res[1][0];
			perms = res[1][1];
			other_perms = res[1][2];
			role = res[1][3];
			user = res[1][4];

			if(other_record.results.length == 1) {
				channel_arr = await get_channels_to_be_in(user, user_type, other_record=other_record);
				main = channel_arr[0];
				others = channel_arr[1];
				dept = channel_arr[2];
				all_c = await get_all_channels(all_courses);
				lists_ready = Promise.all([main, all_c, dept, others]);
			}
			else if(user_type == "Instructors") {
				channel_arr = await get_channels_to_be_in(user, user_type);
				main = channel_arr[0];
				dept = channel_arr[1];
				all_c = await get_all_channels(all_courses);
				lists_ready = Promise.all([main, all_c, dept]);
			}
			else if(user_type == "Students") {
				channel_arr = await get_channels_to_be_in(user, user_type);
				main = channel_arr[0];
				lists_ready = Promise.all([main, all_c]);
			};


			lists_ready.then(arr => {
				channel_ids = arr[0];
				all_courses_ids = arr[1];

				if(arr.length == 3) { // instructor but not a student
					dept_ids = arr[2];
					discord_utils.update_channel_perms(client, user_id, channel_ids, all_courses_ids, perms, dept_ids=dept_ids);
				}
				else if (arr.length == 4) { // instructor that's also a student or student that's also an instructor
					dept_ids = arr[2];
					other_channel_ids = arr[3];
					discord_utils.update_channel_perms(client, user_id, channel_ids, all_courses_ids, perms, other_channel_ids=other_channel_ids, 
						other_perms=other_perms, dept_ids=dept_ids);
				}
				else { // student but not an instructor
					discord_utils.update_channel_perms(client, user_id, channel_ids, all_courses_ids, perms);
				}

				
				discord_utils.check_for_role(client, user_id, role).then((has_role) => {
					if(!has_role) { // checking for role first
							discord_utils.add_role(client, user_id, role); 
					};
				});
				//username = discord_utils.get_user_from_id(client, user_id);
				//username.then(str => discord_utils.send_message_to_channel(client, discord_utils.log_channel_id, `Successfully updated ${str}`)); 

			});
		});
		}
		catch(err) {
			discord_utils.send_message_to_channel(client, discord_utils.log_channel_id, `Failed to update permissions for https://notion.so/bt5/${user.properties['First Name'].title[0].plain_text}-${user.id}`);
		}
	};
};

async function get_channels_to_be_in(user, user_type, other_record=undefined) {
	try {

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
			
			//get_channels_to_be_in.channel_ids.push(...dept_channel_ids);

			if (typeof other_record !== 'undefined') { // add student channel ids here
				student_channels = [];
				for(ch_id of other_record.results[0].properties['Course Channel IDs (Test)'].rollup.array) {
					student_channels.push(ch_id.text[0].plain_text);
				};

				//get_channels_to_be_in.channel_ids.push(...student_channels);
				return [get_channels_to_be_in.channel_ids, student_channels, dept_channel_ids];
			}
			else {
				return [get_channels_to_be_in.channel_ids, dept_channel_ids];
			};
			
		});
		return return_list;
	};

	if(user_type == "Students" && typeof other_record !== 'undefined') {
		instructor_channels = []
		for(ch_id of other_record.results[0].properties['Course Channel IDs (Test)'].rollup.array) {
			instructor_channels.push(ch_id.text[0].plain_text);
		};
		//get_channels_to_be_in.channel_ids.push(...instructor_channels);

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

			//instructor_channels.push(...dept_channel_ids);


			//get_channels_to_be_in.channel_ids.push(...dept_channel_ids);
			return [get_channels_to_be_in.channel_ids, instructor_channels, dept_channel_ids];
		});

		return return_list;

	} 
	else if (user_type == "Students"){
		courses_in = notion_utils.get_records(notion, notion_utils.courses_id, filter=filter);
		return_list = courses_in.then(courses_in => { // can't have a plain return statement, so have to use some kind of promise
			return [get_channels_to_be_in.channel_ids];
		});
		return return_list;
	};
	}
	catch(err) {
		discord_utils.send_message_to_channel(client, discord_utils.log_channel_id, `Encountered error while retrieving channel IDs for record ${user.id} in ${user_type}`);
	};
};


async function get_all_channels(all_courses) {

	all_courses_ids = []; // an arr containing the ids of all of our courses
	for (course of all_courses.results) {
		all_courses_ids.push(course.properties['Channel ID'].rich_text[0].plain_text);
	};
	
	all_courses_ids.push(...discord_utils.all_dept_channel_ids);

	return all_courses_ids
};


