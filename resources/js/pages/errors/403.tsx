import ErrorPage from './error-page';

export default function ForbiddenErrorPage(props: Record<string, unknown>) {
    return <ErrorPage {...props} status={403} />;
}
