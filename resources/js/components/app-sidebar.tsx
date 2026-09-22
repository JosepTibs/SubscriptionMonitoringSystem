import { NavFooter } from '@/components/nav-footer';
import { NavMain } from '@/components/nav-main';
import { NavUser } from '@/components/nav-user';
import { Sidebar, SidebarContent, SidebarFooter, SidebarHeader, SidebarMenu, SidebarMenuButton, SidebarMenuItem } from '@/components/ui/sidebar';
import { type NavItem } from '@/types';
import { Link } from '@inertiajs/react';
import { BookOpen, CreditCard, Folder, LayoutGrid, User2, BriefcaseBusiness, ActivityIcon, ChartBar } from 'lucide-react';
import AppLogo from './app-logo';

const mainNavItems: NavItem[] = [
    {
        title: 'Dashboard',
        url: '/dashboard',
        icon: LayoutGrid,
    },
    {
        title: 'Flow',
        url: '/approval-flows',
        icon: ChartBar,
    },
    {
        title: 'Subscriptions',
        url: '/subscriptions',
        icon: CreditCard,
    },
    {
        title: 'Office',
        url: '/offices',
        icon: BriefcaseBusiness,
    },
    {
        title: 'Activity Logs',
        url: '/activity-logs',
        icon: ActivityIcon,
    },
];

const footerNavItems: NavItem[] = [
    {
        title: 'Users',
        url: '/users',
        icon: User2,
    },
    {
        title: "Profile",
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
                <NavMain items={mainNavItems} />
            </SidebarContent>

            <SidebarFooter>
                <NavFooter items={footerNavItems} className="mt-auto" />
                <NavUser />
            </SidebarFooter>
        </Sidebar>
    );
}
