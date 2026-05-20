const { database } = require("../config/database");
module.exports.createShippingInfoTable = async () => {
  try {
    const query = `
      create table if not exists shipping_info(
        id uuid primary key default gen_random_uuid(),
        order_id uuid not null unique,
        full_name varchar(100) not null,
        city varchar(100) not null,
        district varchar(100) not null,
        ward varchar(100) not null,
        address varchar(255) not null,
        state varchar(100) not null,
        phone varchar(10) not null,
        created_at timestamptz default now(),
        foreign key (order_id) references orders(id) on delete cascade
      )
    `;
    await database.query(query);
  } catch (error) {
    console.error("Error creating shipping info table:", error);
    process.exit(1);
  }
};
