import ErrorPage from './error-page';

export default function NotFoundErrorPage(props: Record<string, unknown>) {
    return <ErrorPage {...props} status={404} />;
}
