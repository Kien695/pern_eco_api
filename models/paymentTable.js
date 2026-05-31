const { database } = require("../config/database");
module.exports.createPaymentsTable = async () => {
  try {
    const query = `       
        CREATE TABLE IF NOT EXISTS payments (         
        id UUID DEFAULT gen_random_uuid() PRIMARY KEY,         
        order_id UUID NOT NULL UNIQUE,         
        payment_type VARCHAR(20) NOT NULL CHECK (payment_type IN ('Online','COD')),         
        payment_status VARCHAR(20) NOT NULL CHECK (payment_status IN ('Paid', 'Pending', 'Failed')),         
         
        created_at TIMESTAMP DEFAULT NOW(),         
        FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE       
    );`;
    await database.query(query);
  } catch (error) {
    console.error(" Failed To Create Payments Table.", error);
    process.exit(1);
  }
};
