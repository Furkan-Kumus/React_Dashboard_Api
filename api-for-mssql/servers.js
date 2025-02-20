const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const { sql, poolPromise } = require('./db.js');

const app = express();
app.use(bodyParser.json());
app.use(cors());

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Server is running on ${PORT}`));

//GET all users (10)
app.get("/api/users", async (req, res) => {
    try {
        const pool = await poolPromise;

        // Sayfa numarası ve limit değerlerini al
        let page = parseInt(req.query.page) || 1; // Varsayılan olarak 1. sayfa
        let limit = parseInt(req.query.limit) || 10; // Varsayılan olarak 10 kullanıcı

        // Başlangıç indexini hesapla
        let startIndex = (page - 1) * limit;

        // Toplam kullanıcı sayısını al
        const totalResult = await pool.request().query("SELECT COUNT(*) AS total FROM users");
        const totalUsers = totalResult.recordset[0].total;

        // Kullanıcıları sayfalama ile getir
        const result = await pool.request().query(`
            SELECT * FROM users 
            ORDER BY id OFFSET ${startIndex} ROWS FETCH NEXT ${limit} ROWS ONLY
        `);

        res.status(200).json({
            success: true,
            currentPage: page,
            totalPages: Math.ceil(totalUsers / limit),
            totalUsers: totalUsers,
            empData: result.recordset
        });

    } catch (error) {
        console.log('Error', error);
        res.status(500).json({
            success: false,
            message: "Server error, try again",
            error: error.message
        });
    }
});



//GET users by id
app.get("/api/users/:id", async (req, res) => {
    try {
        const { id } = req.params;

        if (isNaN(id)) {
            return res.status(400).json({
                success: false,
                message: "Invalid id"
            });

        }

        const pool = await poolPromise;
        const result =
            await pool.request().input("id", sql.Int, id).query("SELECT * FROM users WHERE id = @id");
        console.log(result);

        if (result.recordset.length === 0) {
            return res.status(404).json({
                success: false,
                message: "User details not found!"
            });
        }

        res.status(200).json({
            success: true,
            empData: result.recordset[0]
        });
    } catch (error) {
        console.log('Error', error);
        res.status(500).json({
            success: false,
            message: "Server error, try again",
            error: error.message
        });
    }
});

//ADD user
app.post("/api/users", async (req, res) => {
    try {
        const { name, email, role, status } = req.body;

        if (!name || !email || !role || !status) {
            return res.status(400).json({
                success: false,
                message: "All fields (name, email, role, status) are required",
            });
        }

        const pool = await poolPromise;
        const result = await pool
            .request()
            .input("name", sql.VarChar, name)
            .input("email", sql.VarChar, email)
            .input("role", sql.VarChar, role)
            .input("status", sql.VarChar, status)
            .query(`
                INSERT INTO users (name, email, role, status) 
                VALUES (@name, @email, @role, @status)
            `);

        res.status(201).json({
            success: true,
            message: "User added successfully",
            affectedRows: result.rowsAffected,
        });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});

//UPDATE user
app.put("/api/users/:id", async (req, res) => {
    try {
        const { id } = req.params;
        const { name, email, role, status } = req.body;

        if (!name || !email || !role || !status) {
            return res.status(400).json({
                success: false,
                message: "All fields (name, email, role, status) are required",
            });
        }

        const pool = await poolPromise;
        const result = await pool
            .request()
            .input("id", sql.Int, id)
            .input("name", sql.VarChar, name)
            .input("email", sql.VarChar, email)
            .input("role", sql.VarChar, role)
            .input("status", sql.VarChar, status)
            .query(`
                UPDATE users SET name = @name, email = @email, role = @role, status = @status WHERE id = @id;

            `);

        res.status(201).json({
            success: true,
            message: "User added successfully",
            affectedRows: result.rowsAffected,
        });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});

//DELETE users by id
app.delete("/api/users/:id", async (req, res) => {
    try {
        const { id } = req.params;

        if (isNaN(id)) {
            return res.status(400).json({
                success: false,
                message: "Invalid id"
            });

        }

        const pool = await poolPromise;
        const result =
            await pool
            .request()
            .input("id", sql.Int, id)
            .query("DELETE FROM users WHERE id = @id");
        console.log(result);

        res.status(201).json({
            success: true,
            message: "User deleted successfully",
            affectedRows: result.rowsAffected,
        });
    } catch (error) {
        console.log('Error', error);
        res.status(500).json({
            success: false,
            message: "Server error, try again",
            error: error.message
        });
    }
});

// Kategorilere göre satış istatistiklerini getiren endpoint
app.get("/api/sales/by-category", async (req, res) => {
    try {
        const pool = await poolPromise;
        
        // Her kategori için toplam satış tutarını hesapla (miktar * fiyat)
        const result = await pool.request().query(`
            SELECT 
                category,
                SUM(price * quantity) as value
            FROM sales
            GROUP BY category
            ORDER BY value DESC
        `);

        res.status(200).json({
            success: true,
            data: result.recordset
        });

    } catch (error) {
        console.log('Error:', error);
        res.status(500).json({
            success: false,
            message: "Server error, try again",
            error: error.message
        });
    }
});

// satış istatistikleri için api
app.get("/api/sales/stats", async (req, res) => {
    try {
        const pool = await poolPromise;

        // Toplam Gelir (Total Revenue)
        const totalRevenueResult = await pool.request().query(`
            SELECT SUM(price * quantity) as totalRevenue
            FROM sales
        `);

        // Ortalama Sipariş Değeri (Average Order Value)
        const avgOrderValueResult = await pool.request().query(`
            SELECT AVG(price) as averageOrderValue
            FROM sales
        `);

        // Satış Başına Adet (Conversion Rate)
        const totalOrdersResult = await pool.request().query(`
            SELECT COUNT(*) as totalOrders FROM sales
        `);

        const totalVisits = 1000; // Örnek olarak sabit bir ziyaretçi sayısı
        const conversionRate = ((totalOrdersResult.recordset[0].totalOrders / totalVisits) * 100).toFixed(2);

        // Satış Büyümesi (Sales Growth) - Önceki yılın verisi olmadığı için bu kısmı kaldırdık
        const salesGrowth = 0; // Eğer önceki yıl verisi yoksa, büyüme oranını sıfır kabul edebiliriz.

        res.status(200).json({
            success: true,
            data: {
                totalRevenue: `$${totalRevenueResult.recordset[0].totalRevenue.toFixed(2)}`,
                averageOrderValue: `$${avgOrderValueResult.recordset[0].averageOrderValue.toFixed(2)}`,
                conversionRate: `${conversionRate}%`,
                salesGrowth: `${salesGrowth}%`
            }
        });

    } catch (error) {
        console.log('Error:', error);
        res.status(500).json({
            success: false,
            message: "Server error, try again",
            error: error.message
        });
    }
});

