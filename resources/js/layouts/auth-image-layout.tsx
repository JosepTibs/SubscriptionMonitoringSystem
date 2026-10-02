import AuthImageLayoutTemplate from '@/layouts/auth/auth-image-layout';

interface AuthImageLayoutProps {
    children: React.ReactNode;
    title: string;
    description: string;
    imageSrc?: string;
    overlayClassName?: string;
}

export default function AuthImageLayout({ children, title, description, ...props }: AuthImageLayoutProps) {
    return (
        <AuthImageLayoutTemplate title={title} description={description} {...props}>
            {children}
        </AuthImageLayoutTemplate>
    );
}
