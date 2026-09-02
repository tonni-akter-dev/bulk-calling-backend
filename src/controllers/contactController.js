const contactService = require('../services/contactService');

async function listContacts(req, res) {
  const data = await contactService.listContacts(req.user.companyId, req.query);
  res.json(data);
}

async function createContact(req, res) {
  const contact = await contactService.createContact(req.user.companyId, req.body);
  res.status(201).json({ message: 'Contact added successfully', contact });
}

async function importCsv(req, res) {
  const result = await contactService.importCsv(req.user.companyId, req.file?.buffer, req.body.group);
  res.json({ message: 'Contacts imported successfully', ...result });
}

async function updateContact(req, res) {
  await contactService.updateContact(req.user.companyId, req.params.id, req.body);
  res.json({ message: 'Contact updated successfully' });
}

async function deleteContact(req, res) {
  await contactService.deleteContact(req.user.companyId, req.params.id);
  res.json({ message: 'Contact deleted successfully' });
}

module.exports = { listContacts, createContact, importCsv, updateContact, deleteContact };