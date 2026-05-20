const { database } = require("../config/database");
module.exports.createproduct = async () => {
  try {
    const query = `
    create table if not exists products(
        id uuid primary key default gen_random_uuid(),
        name varchar(100) not null,
        description text not null,
        price decimal(10, 2) not null check (price >= 0),
        category varchar(50) not null,
        ratings decimal(3, 2) default 0 check (ratings >= 0 and ratings <= 5),
        stock integer not null check (stock >= 0),
        images jsonb default '[]'::jsonb,
        created_at timestamptz default now(),
        created_by uuid references users(id),
        foreign key (created_by) references users(id) on delete cascade
    )
    `;
    await database.query(query);
  } catch (error) {
    console.error("Error creating product:", error);
    process.exit(1);
  }
};
