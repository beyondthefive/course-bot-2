const { Client : DiscordClient, Collection, Intents, Guild, GuildMember, Permissions } = require('discord.js');

const guild_id = "691976404983611412"; // updated to main
const enrolled_id = "696391357022863392"; // updated to main
const teacher_id = "863306524939649034"; // updated to main
const log_channel_id = "695982523947286598"; // updated to main

async function update_channel_perms(client, uid, channel_ids, all_channel_ids, perms, other_channel_ids=[], other_perms=undefined, dept_ids=[]) { 
	// channel_ids is an arr containing the channel IDs of the courses they should be in
	// all_channel_ids is an arr containing all of the course channel IDs (refreshed every 5s before updating perms)
	dept_perms = { VIEW_CHANNEL: true, SEND_MESSAGES : true};
	guild = await client.guilds.fetch(guild_id);
	member = await guild.members.fetch(uid);
	for (id of all_channel_ids) {
		channel = await guild.channels.fetch(id);
		// will clean up later
		if(channel_ids.includes(id) || other_channel_ids.includes(id) || dept_ids.includes(id)) {
			if(perms == { VIEW_CHANNEL: true, SEND_MESSAGES : true, MANAGE_MESSAGES : true}) {
				if (other_channel_ids.includes(id) && typeof other_perms !== 'undefined'){
					channel.permissionOverwrites.edit(member, other_perms);
				}
				if(channel_ids.includes(id)) {
					channel.permissionOverwrites.edit(member, perms); // what i think is the v12/v13 equivalent of channel.updateOverwrite()
				} 
			}
			else {
				if(channel_ids.includes(id)) {
					channel.permissionOverwrites.edit(member, perms); // what i think is the v12/v13 equivalent of channel.updateOverwrite()
				} 
				if (other_channel_ids.includes(id) && typeof other_perms !== 'undefined'){
				channel.permissionOverwrites.edit(member, other_perms);
				}
			}
			if (dept_ids.includes(id)) {
				channel.permissionOverwrites.edit(member, dept_perms);
			}
		}
		else {
			try {
				channel.permissionOverwrites.delete(member);
			}
			catch(err) {
				
			}

			 
		}

	}
	
};

async function add_role(client, uid, role_id) {
	try {
	guild = await client.guilds.fetch(guild_id);
	member = await guild.members.fetch(uid);
	role = await guild.roles.fetch(role_id);
	await member.roles.add(role);
	}
	catch(err) {
		send_message_to_channel(client, log_channel_id, `Failed to add role ${role_id} to ${uid}`);
	}
};

async function remove_role(client, uid, role_id) {
	try {
	guild = await client.guilds.fetch(guild_id);
	member = await guild.members.fetch(uid);
	role = await guild.roles.fetch(role_id);
	member.roles.remove(role);
	}
	catch(err) {
		send_message_to_channel(client, log_channel_id, `Failed to remove role ${role_id} from ${uid}`);
	}
};

async function check_for_role(client, uid, role_id) {
	guild = await client.guilds.fetch(guild_id);
	member = await guild.members.fetch(uid);
	return member._roles.includes(role_id);
};

async function get_user_from_id(client, uid) {
	guild = await client.guilds.fetch(guild_id);
	member = await guild.members.fetch(uid);
	return `${member.user.tag}`;
};

async function get_id_from_user(client, username) {
	guild = await client.guilds.fetch(guild_id);
	uid = await guild.members.search({query : username.substring(0, username.length-5)});

	results = [...uid.values()];

	user_id = "Not Found";

	for(res of results) {
		if(res.user.discriminator == username.substring(username.length-4, username.length)) {
			user_id = res.user.id; 
		}
	};

	return user_id;
 
};

async function send_message_to_channel(client, channel_id, msg) {
	guild = await client.guilds.fetch(guild_id);
	channel = await guild.channels.fetch(channel_id);
	channel.send(msg);
};




module.exports = {
	update_channel_perms : update_channel_perms,
	add_role : add_role,
	remove_role : remove_role,
	check_for_role : check_for_role,
	get_user_from_id : get_user_from_id,
	get_id_from_user : get_id_from_user,
	send_message_to_channel : send_message_to_channel,
	guild_id : guild_id,
	enrolled_id : enrolled_id,
	teacher_id : teacher_id,
	log_channel_id : log_channel_id,
	all_dept_channel_ids : ["713557062331793438", "713557111006822400", "713557160080179225", "713557196213846066", "713559021931593810", "713557024469680579", "713557224559214592", "713557312840925184", "713557363063259198"]
};

// main channel ids: ["713557062331793438", "713557111006822400", "713557160080179225", "713557196213846066", "713559021931593810", "713557024469680579", "713557224559214592", "713557312840925184", "713557363063259198"]
// test server: ["878142316555165736", "878142356170346527", "878142874485686303", "878142269771882527", "878142826804813855", "878143102139908146", "878143010674724924", "878143066379288596", "878143135283314739"]