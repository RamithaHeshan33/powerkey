const bcrypt = require('bcrypt');

async function createTables(db) {

    const tables = [
        `CREATE TABLE IF NOT EXISTS company (
            company_id int NOT NULL AUTO_INCREMENT,
            name varchar(200) NOT NULL,
            is_taxable tinyint(1) NOT NULL DEFAULT '0',
            tax_number varchar(100) DEFAULT NULL,
            company_logo varchar(255) DEFAULT NULL,
            address text,
            contact_number varchar(20) DEFAULT '',
            email_address varchar(255) DEFAULT NULL,
            registration_number varchar(100) NOT NULL,
            terms_and_conditions text,
            notes text,
            created_at timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
            PRIMARY KEY (company_id),
            UNIQUE KEY unique_registration_number (registration_number)
        )`,
        `CREATE TABLE IF NOT EXISTS tax_rates (
            tax_rate_id INT AUTO_INCREMENT PRIMARY KEY,
            company_id int NOT NULL,
            name VARCHAR(100) NOT NULL,
            rate DECIMAL(5,2) NOT NULL,
            is_default BOOLEAN DEFAULT FALSE,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            KEY company_id (company_id),
            CONSTRAINT tax_rates_ibfk_1 FOREIGN KEY (company_id) REFERENCES company (company_id) ON DELETE CASCADE
        )`,
        `CREATE TABLE IF NOT EXISTS role (
            role_id int NOT NULL AUTO_INCREMENT,
            name varchar(100) NOT NULL,
            created_at timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
            PRIMARY KEY (role_id)
        )`,
        `CREATE TABLE IF NOT EXISTS user (
            user_id int NOT NULL AUTO_INCREMENT,
            role_id int NOT NULL,
            full_name varchar(200) NOT NULL,
            username varchar(100) DEFAULT NULL,
            email varchar(255) NOT NULL,
            password_hash varchar(255) DEFAULT NULL,
            created_at timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
            otp_code varchar(10) DEFAULT NULL,
            otp_expiry datetime DEFAULT NULL,
            is_active BOOLEAN DEFAULT TRUE,
            PRIMARY KEY (user_id),
            UNIQUE KEY email (email),
            UNIQUE KEY username (username),
            KEY role_id (role_id),
            CONSTRAINT user_ibfk_1 FOREIGN KEY (role_id) REFERENCES role (role_id)
        )`,
        `CREATE TABLE IF NOT EXISTS customer (
            id INT AUTO_INCREMENT PRIMARY KEY,
            company_id INT NOT NULL,
            name VARCHAR(255),
            email VARCHAR(255),
            is_taxable BOOLEAN DEFAULT FALSE,
            tax_number VARCHAR(100),
            phone VARCHAR(50),
            vehicle_number VARCHAR(100),
            credit_limit DECIMAL(12, 2) DEFAULT 0.00,
            current_balance DECIMAL(12, 2) DEFAULT 0.00,
            billing_address VARCHAR(255),
            billing_city VARCHAR(100),
            billing_province VARCHAR(100),
            billing_postal_code VARCHAR(20),
            billing_country VARCHAR(100),
            shipping_same_as_billing BOOLEAN DEFAULT FALSE,
            shipping_address VARCHAR(255),
            shipping_city VARCHAR(100),
            shipping_province VARCHAR(100),
            shipping_postal_code VARCHAR(20),
            shipping_country VARCHAR(100),
            primary_payment_method VARCHAR(100),
            terms VARCHAR(100),
            delivery_option VARCHAR(100),
            invoice_language VARCHAR(100),
            sales_tax_registration VARCHAR(100),
            opening_balance DECIMAL(12, 2) DEFAULT 0.00,
            is_active BOOLEAN DEFAULT TRUE,
            as_of_date varchar(255),
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            FOREIGN KEY (company_id) REFERENCES company(company_id) ON DELETE CASCADE
        );`,
        `CREATE TABLE IF NOT EXISTS vendor (
            vendor_id INT AUTO_INCREMENT PRIMARY KEY,
            company_id INT,
            name VARCHAR(255) NOT NULL,
            vendor_company_name VARCHAR(255) NULL,
            email VARCHAR(255),
            phone VARCHAR(50),
            address TEXT,
            city VARCHAR(100),
            state VARCHAR(100),
            zip_code VARCHAR(20),
            country VARCHAR(100),
            tax_number VARCHAR(100),
            fax_number VARCHAR(50),
            website VARCHAR(255),
            terms VARCHAR(255),
            account_number VARCHAR(100),
            balance DECIMAL(15, 2) DEFAULT 0,
            as_of_date varchar(255),
            vehicle_number varchar(50),
            billing_rate DECIMAL(10, 2) DEFAULT 0.00,
            default_expense_category VARCHAR(255),
            is_active BOOLEAN DEFAULT TRUE,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            KEY company_id (company_id),
            CONSTRAINT vendor_ibfk_1 FOREIGN KEY (company_id) REFERENCES company(company_id) ON DELETE CASCADE
        )`,
        `CREATE TABLE IF NOT EXISTS employees (
            id int NOT NULL AUTO_INCREMENT,
            name varchar(200) NOT NULL,
            email varchar(255),
            phone varchar(20),
            address text,
            hire_date varchar(255),
            is_active BOOLEAN DEFAULT TRUE,
            created_at timestamp DEFAULT CURRENT_TIMESTAMP,
            PRIMARY KEY (id),
            UNIQUE KEY email (email)
        )`,
        `CREATE TABLE IF NOT EXISTS product_categories (
            id INT AUTO_INCREMENT PRIMARY KEY,
            company_id INT NOT NULL,
            name VARCHAR(100) NOT NULL,
            is_active BOOLEAN DEFAULT TRUE,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (company_id) REFERENCES company(company_id) ON DELETE CASCADE
        )`,
        `CREATE TABLE IF NOT EXISTS products (
            id int NOT NULL AUTO_INCREMENT,
            company_id int NOT NULL,
            sku varchar(100),
            name varchar(200) NOT NULL,
            image varchar(255),
            description text,
            category_id int,
            preferred_vendor_id int,
            added_employee_id int,
            unit_price decimal(15,2) DEFAULT 0,
            cost_price decimal(15,2) DEFAULT 0,
            quantity_on_hand int DEFAULT 0,
            reorder_level int DEFAULT 0,
            is_active BOOLEAN DEFAULT TRUE,
            created_at timestamp DEFAULT CURRENT_TIMESTAMP,
            PRIMARY KEY (id),
            KEY company_id (company_id),
            KEY category_id (category_id),
            KEY preferred_vendor_id (preferred_vendor_id),
            KEY added_employee_id (added_employee_id),
            CONSTRAINT products_ibfk_1 FOREIGN KEY (company_id) REFERENCES company (company_id) ON DELETE CASCADE,
            CONSTRAINT products_ibfk_2 FOREIGN KEY (category_id) REFERENCES product_categories (id) ON DELETE SET NULL,
            CONSTRAINT products_ibfk_3 FOREIGN KEY (preferred_vendor_id) REFERENCES vendor (vendor_id) ON DELETE SET NULL,
            CONSTRAINT products_ibfk_4 FOREIGN KEY (added_employee_id) REFERENCES employees (id) ON DELETE SET NULL
        )`,
        `CREATE TABLE IF NOT EXISTS estimates (
            id INT AUTO_INCREMENT PRIMARY KEY,
            estimate_number VARCHAR(100) NOT NULL UNIQUE,
            company_id INT NOT NULL,
            customer_id INT NOT NULL,
            employee_id INT,
            estimate_date VARCHAR(255) NOT NULL,
            expiry_date VARCHAR(255),
            subtotal DECIMAL(15,2) NOT NULL DEFAULT 0.00,
            discount_type ENUM('percentage', 'fixed') NOT NULL,
            discount_amount DECIMAL(15,2) NOT NULL DEFAULT 0.00,
            tax_amount DECIMAL(15,2) NOT NULL DEFAULT 0.00,
            total_amount DECIMAL(15,2) NOT NULL DEFAULT 0.00,
            status ENUM('pending', 'accepted', 'declined', 'closed') NOT NULL DEFAULT 'pending',
            is_active BOOLEAN DEFAULT TRUE,
            notes TEXT,
            terms TEXT,
            shipping_address VARCHAR(255),
            billing_address VARCHAR(255),
            ship_via VARCHAR(100),
            shipping_date VARCHAR(255),
            tracking_number VARCHAR(100),
            invoice_id INT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            KEY company_id (company_id),
            KEY customer_id (customer_id),
            KEY employee_id (employee_id),
            KEY invoice_id (invoice_id),
            CONSTRAINT estimates_ibfk_1 FOREIGN KEY (company_id) REFERENCES company(company_id) ON DELETE CASCADE,
            CONSTRAINT estimates_ibfk_2 FOREIGN KEY (customer_id) REFERENCES customer(id),
            CONSTRAINT estimates_ibfk_3 FOREIGN KEY (employee_id) REFERENCES employees(id) ON DELETE SET NULL
        )`,
        `CREATE TABLE IF NOT EXISTS estimate_items (
            id INT AUTO_INCREMENT PRIMARY KEY,
            estimate_id INT NOT NULL,
            product_id INT NOT NULL,
            description TEXT NOT NULL,
            quantity DECIMAL(10,2) NOT NULL DEFAULT 1.00,
            unit_price DECIMAL(15,2) NOT NULL DEFAULT 0.00,
            actual_unit_price DECIMAL(15,2) NOT NULL DEFAULT 0.00,
            tax_rate DECIMAL(5,2) NOT NULL DEFAULT 0.00,
            tax_amount DECIMAL(15,2) NOT NULL DEFAULT 0.00,
            total_price DECIMAL(15,2) NOT NULL DEFAULT 0.00,
            FOREIGN KEY (estimate_id) REFERENCES estimates(id) ON DELETE CASCADE,
            FOREIGN KEY (product_id) REFERENCES products(id)
        )`,
        `CREATE TABLE IF NOT EXISTS invoices (
            id INT AUTO_INCREMENT PRIMARY KEY,
            company_id INT NOT NULL,
            customer_id INT NOT NULL,
            employee_id INT,
            estimate_id INT,
            invoice_number VARCHAR(50) NOT NULL UNIQUE,
            invoice_date DATE NOT NULL,
            due_date DATE,
            discount_type ENUM('percentage', 'fixed') DEFAULT 'fixed',
            discount_value DECIMAL(10,2) DEFAULT 0.00,
            notes TEXT,
            terms TEXT,
            shipping_address TEXT,
            billing_address TEXT,
            ship_via VARCHAR(100),
            shipping_date DATE,
            tracking_number VARCHAR(100),
            subtotal DECIMAL(10,2) NOT NULL,
            tax_amount DECIMAL(10,2) DEFAULT 0.00,
            discount_amount DECIMAL(10,2) DEFAULT 0.00,
            total_amount DECIMAL(10,2) NOT NULL,
            status ENUM('draft', 'sent', 'paid', 'partially_paid', 'overdue', 'cancelled') DEFAULT 'draft',
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            FOREIGN KEY (company_id) REFERENCES company(company_id),
            FOREIGN KEY (customer_id) REFERENCES customer(id),
            FOREIGN KEY (employee_id) REFERENCES employees(id),
            FOREIGN KEY (estimate_id) REFERENCES estimates(id)
        )`,
        `CREATE TABLE  IF NOT EXISTS invoice_items (
            id INT AUTO_INCREMENT PRIMARY KEY,
            invoice_id INT NOT NULL,
            product_id INT,
            product_name VARCHAR(255),
            description TEXT NOT NULL,
            quantity DECIMAL(10,2) NOT NULL,
            unit_price DECIMAL(10,2) NOT NULL,
            actual_unit_price DECIMAL(10,2) NOT NULL,
            tax_rate DECIMAL(5,2) NOT NULL,
            tax_amount DECIMAL(10,2) NOT NULL,
            total_price DECIMAL(10,2) NOT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            FOREIGN KEY (invoice_id) REFERENCES invoices(id),
            FOREIGN KEY (product_id) REFERENCES products(id)
        )`,
        `CREATE TABLE IF NOT EXISTS invoice_attachments (
            id INT AUTO_INCREMENT PRIMARY KEY,
            invoice_id INT NOT NULL,
            file_path VARCHAR(255) NOT NULL,
            file_name VARCHAR(255) NOT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            FOREIGN KEY (invoice_id) REFERENCES invoices(id)
        )`,

        // `CREATE TABLE IF NOT EXISTS orders (
        //     id INT AUTO_INCREMENT PRIMARY KEY,
        //     company_id INT NOT NULL,
        //     vendor_id INT,
        //     mailling_address TEXT,
        //     email VARCHAR(255),
        //     customer_id INT,
        //     shipping_address TEXT,
        //     order_no VARCHAR(100) NOT NULL,
        //     order_date DATE NOT NULL,
        //     category_id INT,
        //     class VARCHAR(100),
        //     location VARCHAR(100),
        //     ship_via VARCHAR(100),
        //     total_amount DECIMAL(15,2) DEFAULT 0.00,
        //     status ENUM('open', 'closed') DEFAULT 'open',
        //     created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        //     KEY company_id (company_id),
        //     KEY vendor_id (vendor_id),
        //     KEY customer_id (customer_id),
        //     KEY category_id (category_id),
        //     CONSTRAINT orders_ibfk_1 FOREIGN KEY (company_id) REFERENCES company (company_id) ON DELETE CASCADE,
        //     CONSTRAINT orders_ibfk_2 FOREIGN KEY (vendor_id) REFERENCES vendor (vendor_id) ON DELETE SET NULL,
        //     CONSTRAINT orders_ibfk_3 FOREIGN KEY (customer_id) REFERENCES customer (id) ON DELETE SET NULL,
        //     CONSTRAINT orders_ibfk_4 FOREIGN KEY (category_id) REFERENCES categories (id) ON DELETE SET NULL
        // )`,
        // `CREATE TABLE IF NOT EXISTS order_items (
        //     id INT AUTO_INCREMENT PRIMARY KEY,
        //     order_id INT NOT NULL,
        //     product_id INT,
        //     name VARCHAR(200) NOT NULL,
        //     sku VARCHAR(100),
        //     description TEXT,
        //     qty INT NOT NULL,
        //     rate DECIMAL(15,2) NOT NULL,
        //     amount DECIMAL(15,2) DEFAULT 0.00,
        //     class VARCHAR(100),
        //     received BOOLEAN DEFAULT FALSE,
        //     closed BOOLEAN DEFAULT FALSE,
        //     created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        //     KEY order_id (order_id),
        //     KEY product_id (product_id),
        //     CONSTRAINT order_items_ibfk_1 FOREIGN KEY (order_id) REFERENCES orders (id) ON DELETE CASCADE,
        //     CONSTRAINT order_items_ibfk_2 FOREIGN KEY (product_id) REFERENCES products (id) ON DELETE SET NULL
        // )`
        // `CREATE TABLE IF NOT EXISTS invoices (
        //     id int NOT NULL AUTO_INCREMENT,
        //     company_id int NOT NULL,
        //     invoice_number varchar(100),
        //     customer_id int,
        //     employee_id int,
        //     estimate_id int,
        //     invoice_date date NOT NULL,
        //     due_date date,
        //     subtotal decimal(15,2) DEFAULT 0,
        //     discount_type enum('percentage','fixed') DEFAULT 'fixed',
        //     discount_value decimal(15,2) DEFAULT 0,
        //     discount_amount decimal(15,2) DEFAULT 0,
        //     tax_amount decimal(15,2) DEFAULT 0,
        //     total_amount decimal(15,2) DEFAULT 0,
        //     paid_amount decimal(15,2) DEFAULT 0,
        //     balance_due decimal(15,2) DEFAULT 0,
        //     status enum('draft','sent','paid','partially_paid','overdue','cancelled') DEFAULT 'draft',
        //     notes text,
        //     terms text,
        //     created_at timestamp DEFAULT CURRENT_TIMESTAMP,
        //     PRIMARY KEY (id),
        //     KEY company_id (company_id),
        //     KEY customer_id (customer_id),
        //     CONSTRAINT invoices_ibfk_1 FOREIGN KEY (company_id) REFERENCES company (company_id),
        //     CONSTRAINT invoices_ibfk_2 FOREIGN KEY (customer_id) REFERENCES customers (id)
        // )`,
        // `CREATE TABLE IF NOT EXISTS categories (
        //     id INT AUTO_INCREMENT PRIMARY KEY,
        //     name VARCHAR(100) NOT NULL UNIQUE,
        //     description TEXT,
        //     amount DECIMAL(15,2) DEFAULT 0.00,
        //     tax_rate_id INT DEFAULT NULL,
        //     employee_id INT DEFAULT NULL,
        //     company_id INT NOT NULL,
        //     created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        //     FOREIGN KEY (tax_rate_id) REFERENCES tax_rates(tax_rate_id) ON DELETE SET NULL,
        //     FOREIGN KEY (employee_id) REFERENCES employees(id) ON DELETE SET NULL,
        //     FOREIGN KEY (company_id) REFERENCES company(company_id) ON DELETE CASCADE
        // )`
    ];

    for (const table of tables) {
        try {
        await db.execute(table);
        } catch (error) {
        console.error('Error creating table:', error);
        }
    }

    // Insert default roles if they don't exist
    try {
    // Insert roles if not exist
    const [existingRoles] = await db.execute('SELECT COUNT(*) as count FROM role');
    if (existingRoles[0].count === 0) {
        await db.execute(`
            INSERT INTO role (name) VALUES 
            ('admin'),
            ('sales'),
            ('staff')
        `);
        console.log('Default roles (admin, sales, staff) inserted');
    }

    // Users to insert
    const users = [
        {
            role_id: 1, // admin
            full_name: '',
            username: '',
            email: '',
            password: ''
        },
        {
            role_id: 2, // sales
            full_name: 'Nimal Perera',
            username: 'nimalP',
            email: 'nimal.sales@example.com',
            password: 'nP@123456'
        },
        {
            role_id: 3, // staff
            full_name: 'Suneth Silva',
            username: 'sunethS',
            email: 'suneth.staff@example.com',
            password: 'sS@789123'
        }
    ];

    // Insert users if user table is empty
    const [existingUser] = await db.execute('SELECT COUNT(*) as count FROM user');
    if (existingUser[0].count === 0) {
        for (const user of users) {
            const passwordHash = await bcrypt.hash(user.password, 10);
            await db.execute(
                `INSERT INTO user (role_id, full_name, username, email, password_hash)
                 VALUES (?, ?, ?, ?, ?)`,
                [user.role_id, user.full_name, user.username, user.email, passwordHash]
            );
            console.log(`Default user inserted: ${user.email} (Role ID: ${user.role_id})`);
        }
    }
    } catch (error) {
        console.error('Error inserting default data:', error);
    }

}

module.exports = createTables;