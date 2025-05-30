// src/components/Modal/Modal.jsx
import React from 'react';
import './Modal.css'; // We'll create this CSS file next

const Modal = ({ isOpen, onClose, title, children }) => {
    if (!isOpen) {
        return null;
    }

    return (
        <div className="modal-overlay" onClick={onClose}> {/* Clicking overlay closes modal */}
            <div className="modal-content" onClick={(e) => e.stopPropagation()}> {/* Prevent click inside modal from closing it */}
                <div className="modal-header">
                    {title && <h3 className="modal-title">{title}</h3>}
                    <button className="modal-close-button" onClick={onClose}>
                        &times; {/* HTML entity for 'X' */}
                    </button>
                </div>
                <div className="modal-body">
                    {children}
                </div>
            </div>
        </div>
    );
};

export default Modal;