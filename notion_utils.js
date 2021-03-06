const discord_utils = require('./discord_utils');

async function get_records(notion, database_id, filter = undefined, sorts = undefined) { 
	try {
	// filter (object, see docs) specifies which records to get (most common use case is getting only the records w/ the "NEED BOT TO UPDATE" property checked)
	// sorts (array of sort objects, see docs) orders the pages in the returned object according to specified properties

	// conditionally add properties to the request based on specified params
  const response = await notion.databases.query({
    database_id: database_id,
    ...(!(filter == undefined) && {filter : filter}),
    ...(!(sorts == undefined) && {sorts : sorts})
  });
  return response;
 }
 catch(err) {
	console.log(`Failed to retrieve records from ${database_id}`);
 }

};

// just for passing data into the .then() scope within a loop
// hacky sol, will find a cleaner way to do this eventually
async function get_records_with_other_data(notion, database_id, other_data, filter = undefined, sorts = undefined) { 
	try {
	// filter (object, see docs) specifies which records to get (most common use case is getting only the records w/ the "NEED BOT TO UPDATE" property checked)
	// sorts (array of sort objects, see docs) orders the pages in the returned object according to specified properties

	// conditionally add properties to the request based on specified params
  const response = await notion.databases.query({
    database_id: database_id,
    ...(!(filter == undefined) && {filter : filter}),
    ...(!(sorts == undefined) && {sorts : sorts})
  });
  return [response, other_data];  s
	}
	catch(err) {
		console.log(`Failed to retrieve records from ${database_id} with other data`);
	}
};

async function update_record(notion, page_id, new_values) {
	try {
	// new_values is an object that specifies each of the properties to be updated w/ their new values--see docs
	const response = await notion.pages.update({
			page_id : page_id,
			properties : new_values
		});
	return response; 
	}
	catch(err) {
		console.log(`Failed to update record ${page_id}`);
	}
};



async function get_block(notion, block_id, get_subblocks=false) { 
	// retrieves all properties *and* the corresponding content
	// set get_subblocks to true if you also want to get the contents of the subblock(s) in the block
	const response = await notion.blocks.retrieve({
			block_id : block_id
		});

	if(get_subblocks) {
		const subblocks = await notion.blocks.children.list({
			block_id : block_id,
			page_size : 100 // max page size
		}); // further nested subblocks have to be retrieved recursively, will do later
		return [response, subblocks];
	} else {
		return response;
	};
};


module.exports = {
	students_id: "3fa8f9caeccd42a1ad5125193c9aa300",
	instructors_id: "84103a7ceaac47288c73010520bbed0b",
	courses_id: "dd8b86ffaaa9481482dbe75328e51584",
	subjects_id: "daab30bf6f7445228189a4dc416d7e6a",
	get_records: get_records,
	get_records_with_other_data: get_records_with_other_data,
	update_record : update_record,
	get_block : get_block
};