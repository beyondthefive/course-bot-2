const { Client : DiscordClient, Collection, Intents, Guild, GuildMember, Permissions } = require('discord.js');

const guild_id = "876513971191046194";
const enrolled_id = "877798118094143519";
const teacher_id = "879962880559181916";

async function update_channel_perms(client, uid, channel_ids, all_channel_ids, perms) { 
	// channel_ids is an arr containing the channel IDs of the courses they should be in
	// all_channel_ids is an arr containing all of the course channel IDs (refreshed every 5s before updating perms)
	guild = await client.guilds.fetch(guild_id);
	member = await guild.members.fetch(uid);
	for (id of all_channel_ids) {
		channel = await guild.channels.fetch(id);
		if(channel_ids.includes(id)) {
			channel.permissionOverwrites.edit(member, perms); // what i think is the v12/v13 equivalent of channel.updateOverwrite()
		} else {
			try {
				channel.permissionOverwrites.delete(member);
			}
			catch(err) {
				
			}

			 
		}

	}
	
};

async function add_role(client, uid, role_id) {
	guild = await client.guilds.fetch(guild_id);
	member = await guild.members.fetch(uid);
	role = await guild.roles.fetch(role_id);
	member.roles.add(role);
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

module.exports = {
	update_channel_perms : update_channel_perms,
	add_role : add_role,
	check_for_role : check_for_role,
	get_user_from_id : get_user_from_id,
	guild_id : guild_id,
	enrolled_id : enrolled_id,
	teacher_id : teacher_id
};