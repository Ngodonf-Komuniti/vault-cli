export function registerListCommand(program) {
    program
        .command('list')
        .description('List all credentials in the vault')
        .action(() => {
            // TODO: replace with listCredentials() and master password prompt once the service and promptSecret exist.
            const credentials = [
                {name: 'example.com', username: 'user1', url: 'https://example.com', updatedAt: '2026-10-13T00:00:00.000Z'},
                {name: 'testsite.com', username: 'user2', url: 'https://testsite.com', updatedAt: '2026-10-14T00:00:00.000Z'}, 
            ];
            if (credentials.length === 0) {
                console.log('No credentials stored.');
            } else {
                console.table(credentials.map(cred => ({
                    Name: cred.name,
                    Username: cred.username,
                    URL: cred.url,
                    UpdatedAt: cred.updatedAt
                })));
            }
        });
}