const XLSX = require('xlsx');
const workbook = XLSX.readFile('정보.xlsx');
const sheetName = workbook.SheetNames[0];
const worksheet = workbook.Sheets[sheetName];
const data = XLSX.utils.sheet_to_json(worksheet, { header: 1 });

console.log('Headers:', data[0]);
console.log('Sample Row 1:', data[1]);
console.log('Sample Row 2:', data[2]);
