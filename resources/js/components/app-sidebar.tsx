import { NavFooter } from '@/components/nav-footer';
import { NavMain } from '@/components/nav-main';
import { NavUser } from '@/components/nav-user';
import { Sidebar, SidebarContent, SidebarFooter, SidebarHeader, SidebarMenu, SidebarMenuButton, SidebarMenuItem } from '@/components/ui/sidebar';
import { canViewNavItem } from '@/lib/roles';
import { type NavItem, type SharedData } from '@/types';
import { Link, usePage } from '@inertiajs/react';
import { ActivityIcon, BriefcaseBusiness, ClipboardCheck, CreditCard, LayoutGrid, User2 } from 'lucide-react';
import AppLogo from './app-logo';

/** Roles allowed to read the activity trail. */
const adminRoles = ['admin', 'superadmin'];

const mainNavItems: NavItem[] = [
    {
        title: 'Dashboard',
        url: '/dashboard',
        icon: LayoutGrid,
    },
    {
        title: 'Requests',
        url: '/approvals',
        icon: ClipboardCheck,
    },
    {
        title: 'Subscriptions',
        url: '/subscriptions',
        icon: CreditCard,
    },
    {
        title: 'Offices & Flows',
        url: '/offices',
        icon: BriefcaseBusiness,
    },
    {
        title: 'Activity Logs',
        url: '/activity-logs',
        icon: ActivityIcon,
        roles: adminRoles,
    },
];

const footerNavItems: NavItem[] = [
    {
        title: 'Users',
        url: '/users',
        icon: User2,
    },
    {
        title: 'Profile',
        url: '/profile',
        icon: User2,
    },
    // {
    //     title: 'Notifications',
    //     url: '/notifications',
    //     method: 'get',
    //     icon: Bell,
    // },
    // {
    //     title: 'Log Out',
    //     url: '/logout',
    //     method: 'post',
    //     icon: LogOut,
    // },
];

export function AppSidebar() {
    const { auth } = usePage<SharedData>().props;

    /**
     * An entry naming no roles is shown to everyone; otherwise the account has
     * to hold one of the named roles.
     */
    const canSee = (item: NavItem) => canViewNavItem(item, auth.roles);

    return (
        <Sidebar collapsible="icon" variant="inset">
            <SidebarHeader>
                <SidebarMenu>
                    <SidebarMenuItem>
                        <SidebarMenuButton size="lg" asChild>
                            <Link href="/dashboard" prefetch>
                                <AppLogo />
                            </Link>
                        </SidebarMenuButton>
                    </SidebarMenuItem>
                </SidebarMenu>
            </SidebarHeader>

            <SidebarContent>
                <NavMain items={mainNavItems.filter(canSee)} />
            </SidebarContent>

            <SidebarFooter>
                <NavFooter items={footerNavItems.filter(canSee)} className="mt-auto" />
                <NavUser />
            </SidebarFooter>
        </Sidebar>
    );
}
