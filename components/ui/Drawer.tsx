'use client';

import React from 'react';

interface DrawerProps {
    isOpen: boolean;
    onClose: () => void;
    title?: string;
    children?: React.ReactNode;
}

export const Drawer: React.FC<DrawerProps> = ({ isOpen, onClose, title, children }) => {
    return (
        // Keep the container in the DOM for transitions but ensure it does not
        // capture pointer events when closed. Only the visible/open parts
        // should be interactive.
        <div aria-hidden={!isOpen} className={`fixed inset-0 z-50 ${isOpen ? '' : 'pointer-events-none'}`}>
            {/* Backdrop */}
            <div
                onClick={onClose}
                className={`absolute inset-0 bg-black transition-opacity duration-200 ${isOpen ? 'opacity-40 pointer-events-auto' : 'opacity-0 pointer-events-none'}`}
            />

            {/* Drawer panel */}
            <aside
                className={`absolute right-0 top-0 h-full w-full max-w-2xl bg-white shadow-xl transform transition-transform duration-300 ${isOpen ? 'translate-x-0 pointer-events-auto' : 'translate-x-full pointer-events-none'}`}
            >
                <div className="flex items-center justify-between px-6 py-4 border-b">
                    <h2 className="text-lg font-semibold">{title || 'Details'}</h2>
                    <button onClick={onClose} className="text-gray-500 hover:text-gray-700">Close</button>
                </div>
                <div className="p-6 overflow-auto h-[calc(100%-64px)]">{children}</div>
            </aside>
        </div>
    );
};

export default Drawer;
