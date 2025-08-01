const db = require("../DB/db");
const jwt = require('jsonwebtoken');

const createCompany = async (req, res) => {
    try {
        const { 
            companyName, 
            isTaxable, 
            taxNumber, 
            companyAddress, 
            companyPhone, 
            companyEmail,
            companyRegistrationNumber, 
            notes, 
            termsAndConditions,
            taxRates 
        } = req.body;
        const companyLogo = req.file ? `/uploads/${req.file.filename}` : null;

        console.log('Create company request received:', req.body);
        console.log('File received:', req.file);

        // Validate required fields
        if (!companyName || !companyRegistrationNumber) {
            return res.status(400).json({ 
                success: false, 
                message: 'Company name and registration number are required' 
            });
        }

        // Check if company already exists
        const [existingCompany] = await db.query(
            'SELECT * FROM company WHERE registration_number = ?', 
            [companyRegistrationNumber]
        );

        if (existingCompany.length > 0) {
            return res.status(400).json({ success: false, message: 'Company with this registration number already exists.' });
        }

        // Start transaction
        await db.query('START TRANSACTION');

        try {
            // Insert new company
            const [result] = await db.query(
                'INSERT INTO company (name, is_taxable, tax_number, company_logo, address, contact_number, email_address, registration_number, terms_and_conditions, notes) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
                [
                    companyName, 
                    isTaxable === 'Taxable' ? 1 : 0, 
                    isTaxable === 'Taxable' ? taxNumber : null, 
                    companyLogo, 
                    companyAddress || '', 
                    companyPhone || '', 
                    companyEmail || null,
                    companyRegistrationNumber, 
                    termsAndConditions || null, 
                    notes || null
                ]
            );

            if (result.affectedRows === 0) {
                throw new Error('Failed to create company');
            }

            const companyId = result.insertId;

            // Insert tax rates if company is taxable
            if (isTaxable === 'Taxable' && taxRates) {
                let parsedTaxRates;
                try {
                    parsedTaxRates = JSON.parse(taxRates);
                } catch (parseError) {
                    console.error('Error parsing tax rates:', parseError);
                    parsedTaxRates = [];
                }
                
                for (const taxRate of parsedTaxRates) {
                    if (taxRate.name && taxRate.rate > 0) {
                        await db.query(
                            'INSERT INTO tax_rates (company_id, name, rate, is_default) VALUES (?, ?, ?, ?)',
                            [companyId, taxRate.name, taxRate.rate, taxRate.is_default || false]
                        );
                    }
                }
            }

            // Commit transaction
            await db.query('COMMIT');

            console.log('New company created:', result);

            // Return company data along with token
            const companyData = {
                id: companyId,
                name: companyName,
                is_taxable: isTaxable === 'Taxable' ? 1 : 0,
                tax_number: isTaxable === 'Taxable' ? taxNumber : null,
                logo: companyLogo,
                address: companyAddress || '',
                phone: companyPhone || '',
                email: companyEmail || null,
                registration_number: companyRegistrationNumber,
                terms_and_conditions: termsAndConditions || null,
                notes: notes || null
            };

            return res.status(201).json({ 
                success: true, 
                message: 'Company created successfully', 
                company: companyData
            });

        } catch (error) {
            // Rollback transaction on error
            await db.query('ROLLBACK');
            console.error('Transaction error:', error);
            throw error;
        }

    } catch (error) {
        console.error('Error creating company:', error);
        res.status(500).json({ 
            success: false, 
            message: error.message || 'Internal server error',
            details: process.env.NODE_ENV === 'development' ? error.stack : undefined
        });
    }
};

const getCompanies = async (req, res) => {
    try {
        console.log('Get companies request received');
        const [companies] = await db.query('SELECT * FROM company');
        console.log('Companies fetched:', companies);        
        return res.status(200).json(companies);
    } catch (error) {
        console.error('Error fetching companies:', error);
        return res.status(500).json({ success: false, message: 'Internal server error' });
    }
};

const getDashboardData = async (req, res) => {
    try {
        const { companyId } = req.params;
        console.log('Get dashboard data for companyId:', companyId);

        // Get basic metrics
        const [customers] = await db.query('SELECT COUNT(*) as count FROM customer WHERE company_id = ?', [companyId]);
        const [products] = await db.query('SELECT COUNT(*) as count FROM products WHERE company_id = ?', [companyId]);
        const [invoices] = await db.query('SELECT COUNT(*) as count FROM invoices WHERE company_id = ?', [companyId]);
        const [revenue] = await db.query('SELECT COALESCE(SUM(total_amount), 0) as total FROM invoices WHERE company_id = ? AND status != "cancelled"', [companyId]);

        // Get recent invoices
        const [recentInvoices] = await db.query(`
            SELECT 
                i.id,
                i.invoice_number,
                i.total_amount,
                i.created_at,
                c.name as customer_name
            FROM invoices i
            LEFT JOIN customer c ON i.customer_id = c.id
            WHERE i.company_id = ?
            ORDER BY i.created_at DESC
            LIMIT 5
        `, [companyId]);

        const dashboardData = {
            metrics: {
                customers: customers[0]?.count || 0,
                products: products[0]?.count || 0,
                invoices: invoices[0]?.count || 0,
                totalRevenue: revenue[0]?.total || 0
            },
            recentInvoices: recentInvoices || []
        };

        console.log('Dashboard data:', dashboardData);
        return res.status(200).json(dashboardData);

    } catch (error) {
        console.error('Error fetching dashboard data:', error);
        // Return empty data instead of error to prevent dashboard from breaking
        return res.status(200).json({
            metrics: {
                customers: 0,
                products: 0,
                invoices: 0,
                totalRevenue: 0
            },
            recentInvoices: []
        });
    }
};

const selectCompany = async (req, res) => {
    try {
        const { companyId } = req.params;
        console.log('Select company request received for companyId:', companyId);
        
        const [company] = await db.query(
            'SELECT * FROM company WHERE company_id = ?', 
            [companyId]
        );
        
        if (company.length === 0) {
            return res.status(404).json({ success: false, message: 'Company not found' });
        }

        return res.status(200).json({ success: true, message: 'Company selected successfully' });
    } catch (error) {
        console.error('Error selecting company:', error);
        res.status(500).json({ success: false, message: 'Internal server error' });
    }
};

const updateCompany = async (req, res) => {
    try {
        const { companyId } = req.params;
        const updates = req.body;
        const companyLogo = req.file ? `/uploads/${req.file.filename}` : null;
        
        console.log('Update company request received for companyId:', companyId, 'with updates:', updates);

        if (Object.keys(updates).length === 0 && !companyLogo) {
            return res.status(400).json({ success: false, message: 'No fields to update' });
        }

        const allowedFields = [
            'name', 'is_taxable', 'tax_number', 'company_logo', 
            'address', 'contact_number', 'email_address', 
            'registration_number', 'terms_and_conditions', 'notes'
        ];

        const fieldsToUpdate = {};
        for (const key of allowedFields) {
            if (updates[key] !== undefined) {
                fieldsToUpdate[key] = updates[key];
            }
        }

        if (companyLogo) {
            fieldsToUpdate.company_logo = companyLogo;
        }

        // Check if company exists
        const [existingCompanyData] = await db.query(
            'SELECT * FROM company WHERE company_id = ?',
            [companyId]
        );

        if (existingCompanyData.length === 0) {
            return res.status(404).json({ success: false, message: 'Company not found for update' });
        }

        // Handle taxable status
        if (fieldsToUpdate.is_taxable) {
            fieldsToUpdate.is_taxable = fieldsToUpdate.is_taxable === 'Taxable' ? 1 : 0;
            
            // If changing to non-taxable, clear tax number
            if (fieldsToUpdate.is_taxable === 0) {
                fieldsToUpdate.tax_number = null;
            }
        }

        // Check for registration number conflicts
        if (fieldsToUpdate.registration_number) {
            const [conflict] = await db.query(
                'SELECT * FROM company WHERE registration_number = ? AND company_id != ?',
                [fieldsToUpdate.registration_number, companyId]
            );

            if (conflict.length > 0) {
                return res.status(400).json({ success: false, message: 'Company with this registration number already exists' });
            }
        }

        const setClauses = [];
        const values = [];

        for (const key in fieldsToUpdate) {
            setClauses.push(`${key} = ?`);
            values.push(fieldsToUpdate[key]);
        }

        if (setClauses.length === 0) {
            return res.status(400).json({ success: false, message: 'No valid fields to update' });
        }

        values.push(companyId);

        const updateQuery = `UPDATE company SET ${setClauses.join(', ')} WHERE company_id = ?`;
        const [result] = await db.query(updateQuery, values);

        if (result.affectedRows === 0) {
            return res.status(400).json({ success: false, message: 'No changes made to the company' });
        }

        return res.status(200).json({ 
            success: true, 
            message: 'Company updated successfully'
        });

    } catch (error) {
        console.error('Error updating company:', error);
        return res.status(500).json({ success: false, message: 'Internal server error' });
    }
};

const deleteCompany = async (req, res) => {
    try {
        const { companyId } = req.params;
        console.log('Delete company request received for companyId:', companyId);

        // Check if company exists
        const [existingCompany] = await db.query(
            'SELECT * FROM company WHERE company_id = ?',
            [companyId]
        );

        if (existingCompany.length === 0) {
            return res.status(404).json({ success: false, message: 'Company not found' });
        }

        // Start transaction
        await db.query('START TRANSACTION');

        try {
            // Delete related records in the correct order to avoid foreign key constraint errors
            
            // Delete tax rates first
            await db.query('DELETE FROM tax_rates WHERE company_id = ?', [companyId]);
            console.log('Deleted tax rates for company:', companyId);
            
            // Delete customers (note: table name is 'customer' not 'customers')
            await db.query('DELETE FROM customer WHERE company_id = ?', [companyId]);
            console.log('Deleted customers for company:', companyId);
            
            // Delete vendors
            await db.query('DELETE FROM vendor WHERE company_id = ?', [companyId]);
            console.log('Deleted vendors for company:', companyId);
            
            // Delete the company
            const [result] = await db.query('DELETE FROM company WHERE company_id = ?', [companyId]);

            if (result.affectedRows === 0) {
                throw new Error('Failed to delete company');
            }

            // Commit transaction
            await db.query('COMMIT');

            console.log('Company deleted:', companyId);
            return res.status(200).json({ 
                success: true, 
                message: 'Company deleted successfully'
            });

        } catch (error) {
            // Rollback transaction on error
            await db.query('ROLLBACK');
            console.error('Transaction error during company deletion:', error);
            throw error;
        }

    } catch (error) {
        console.error('Error deleting company:', error);
        return res.status(500).json({ 
            success: false, 
            message: 'Internal server error',
            details: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
};

module.exports = { 
    createCompany, 
    selectCompany, 
    getCompanies, 
    getDashboardData,
    updateCompany,
    deleteCompany
};