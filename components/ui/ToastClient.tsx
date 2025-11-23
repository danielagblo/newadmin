"use client";

import React from 'react';
import { ToastProvider } from './Toast';

const ToastClient: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    return <ToastProvider>{children}</ToastProvider>;
};

export default ToastClient;
