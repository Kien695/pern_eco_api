const { database } = require("../config/database");
module.exports.createUser = async () => {
  try {
    const query = `
    create table if not exists users(
        id uuid primary key default gen_random_uuid(),
        name varchar(100) not null,
        email varchar(100) not null unique,
        password text not null,
        role varchar(10) default 'user' check (role in ('user', 'admin')),
        avatar jsonb default null,
        reset_password_token text default null,
        reset_password_expire timestamptz default null,
        created_at timestamp default now()
        )
    `;
    await database.query(query);
  } catch (error) {
    console.error("Error creating user:", error);
    process.exit(1);
  }
};
