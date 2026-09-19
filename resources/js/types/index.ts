import { LucideIcon } from 'lucide-react';

export interface Auth {
    user: User;
}

export interface BreadcrumbItem {
    title: string;
    href: string;
}

export interface NavGroup {
    title: string;
    items: NavItem[];
}

export interface NavItem {
    title: string;
    url: string;
    icon?: LucideIcon | null;
    isActive?: boolean;
}

export interface SharedData {
    name: string;
    quote: { message: string; author: string };
    auth: Auth;
    [key: string]: unknown;
}

export interface Office {
    id: number;
    name: string;
    description: string | null;
}

export interface Renewal {
    id: number;
    subscription_id: number;
    previous_renewal_date: string | null;
    new_renewal_date: string | null;
    previous_cost: string | null;
    new_cost: string | null;
    decision: string;
    reviewed_by: number | null;
    reviewed_at: string | null;
    remarks: string | null;
    reviewer?: User | null;
}

export interface Subscription {
    id: number;
    provider: string;
    name: string;
    cost: string;
    billing_interval: number;
    billing_interval_unit: 'month' | 'year';
    start_date: string;
    renewal_date: string;
    office_id: number | null;
    owner_id: number | null;
    status: 'active' | 'expired' | 'cancelled' | 'suspended';
    description: string | null;
    office?: Office | null;
    owner?: User | null;
    renewals?: Renewal[];
    days_until_renewal?: number;
    [key: string]: unknown;
}

export interface User {
    id: number;
    name: string;
    email: string;
    avatar?: string;
    email_verified_at: string | null;
    created_at: string;
    updated_at: string;
    [key: string]: unknown; // This allows for additional properties...
}
