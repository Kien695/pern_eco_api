const nodeMailer = require("nodemailer");
module.exports.sendMail = async ({ email, subject, message }) => {
  const transporter = nodeMailer.createTransport({
    service: process.env.SMTP_SERVICE,
    auth: {
      user: process.env.SMTP_MAIL,
      pass: process.env.SMTP_PASSWORD,
    },
  });
  const mailOptions = {
    from: process.env.SMTP_MAIL,
    to: email,
    subject: subject,
    html: message,
  };
  await transporter.sendMail(mailOptions);
};
