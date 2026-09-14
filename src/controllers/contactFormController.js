const contactFormService = require('../services/contactFormService');

async function submitForm(req, res) {
  const result = await contactFormService.submitContactForm(req.body);
  res.status(201).json({ 
    success: true,
    message: 'Message sent successfully! We will get back to you soon.', 
    data: result 
  });
}

async function listMessages(req, res) {
  const messages = await contactFormService.listContactMessages(req.query);
  res.json({ success: true, data: messages });
}

async function markAsRead(req, res) {
  await contactFormService.updateMessageStatus(req.params.id, 'Read');
  res.json({ success: true, message: 'Message marked as read' });
}

module.exports = { submitForm, listMessages, markAsRead };