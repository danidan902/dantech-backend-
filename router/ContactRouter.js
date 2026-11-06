import express from "express";
import People from "../models/Contact.js";

const router = express.Router();

// POST: Save a new contact + push notification to admins
router.post("/contact", async (req, res) => {
  try {
    const { name, email, subject, message } = req.body;

    // Validate required fields
    if (!name || !email || !subject || !message) {
      return res.status(400).json({
        success: false,
        message: "All fields are required",
      });
    }

    const contact = new People({
      name: name.trim(),
      email: email.trim().toLowerCase(),
      subject: subject.trim(),
      message: message.trim(),
    });

    await contact.save();

    // ===== PUSH NOTIFICATION TO ADMINS =====
    const io = req.app.get("io");
    if (io) {
      io.to("admins").emit("new-message", {
        id: contact._id,
        name: contact.name,
        email: contact.email,
        subject: contact.subject,
        message: contact.message,
        createdAt: contact.createdAt,
      });
      console.log("📣 Emitted new-message:", contact.subject);
    }

    return res.status(201).json({
      success: true,
      message: "Contact saved successfully",
      contact,
    });
  } catch (error) {
    console.error("Contact save error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to save contact",
    });
  }
});

// GET: Get all contacts
router.get("/contact", async (req, res) => {
  try {
    const contacts = await People.find().sort({ createdAt: -1 });

    return res.status(200).json({
      success: true,
      count: contacts.length,
      contacts,
    });
  } catch (error) {
    console.error("Get contacts error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to retrieve contacts",
    });
  }
});

// DELETE: Delete a contact by ID
router.delete("/contact/:id", async (req, res) => {
  try {
    const { id } = req.params;

    const deletedContact = await People.findByIdAndDelete(id);

    if (!deletedContact) {
      return res.status(404).json({
        success: false,
        message: "Contact not found",
      });
    }

    return res.status(200).json({
      success: true,
      message: "Contact deleted successfully",
    });
  } catch (error) {
    console.error("Delete contact error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to delete contact",
    });
  }
});

export default router;