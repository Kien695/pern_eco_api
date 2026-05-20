const {database} = require("../config/database");
module.exports.createOrdersTable = async () => {
  try {
    const query = `     
        CREATE TABLE IF NOT EXISTS orders (     
        id UUID DEFAULT gen_random_uuid() PRIMARY KEY,     
        buyer_id UUID NOT NULL,     
        total_price DECIMAL(10,2) NOT NULL CHECK (total_price >= 0),     
             
        shipping_price DECIMAL(10,2) NOT NULL CHECK (shipping_price >= 0),     
        order_status VARCHAR(50) DEFAULT 'Processing' CHECK (order_status IN ('Processing', 'Shipped', 'Delivered', 'Cancelled')),     
        paid_at TIMESTAMPTZ CHECK (paid_at IS NULL OR paid_at <= CURRENT_TIMESTAMP),     
        created_at TIMESTAMP DEFAULT NOW(),     
        FOREIGN KEY (buyer_id) REFERENCES users(id) ON DELETE CASCADE         
    );`;
    await database.query(query);
  } catch (error) {
    console.error(" Failed To Create Orders Table.", error);
    process.exit(1);
  }
};
