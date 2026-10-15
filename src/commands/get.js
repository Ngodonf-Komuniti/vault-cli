export function registerGetCommand(program) {
    // Command Register
    program
        .command('get <name>')
        .description("Get one credential key from storage")
        .action((name) => {
            // TODO : Current credential keys are dummy data. Change to getCredential() when available.
            const credentials = [
                {
                    name : 'example.com',
                    username : 'user1',
                    url : 'https://example.com',
                    updatedAt : '2026-10-13T00:00:00.000Z'
                },
                {
                    name : 'testsite.com',
                    username : 'user2',
                    url : 'https://testsite.com',
                    updatedAt : '2026-10-14T00:00:00.000Z'
                },
                {
                    name : 'guthib.com',
                    username : 'user3',
                    url : 'https://guthib.com',
                    updatedAt : '2026-10-14T00:00:00.000Z'
                },
            ];
            const credential = credentials.find(
                (cred) => cred.name === name,
            );

            if(!credential) {
                // TODO : Change with VaultError(CREDENTIAL_NOT_FOUND) when implemented
                throw new Error(`Credential ${name} Not Found!`)
            }

            console.log(`Credential Name : ${credential.name}`);
            console.log(`Credential username : ${credential.username}`);
            console.log(`URL : ${credential.url}`);
            console.log(`Updated At : ${credential.updatedAt}`)
            
        })


}