import { Accounts } from 'meteor/accounts-base';


Meteor.startup(function() {
    const demoUserOptions = {
        email: 'demo@ohif.org',
        password: '12345678aA*',
        profile: {
            fullName: 'Demo User'
        }
    };

    createUser = function(options) {
        const filter = {};
        if (options.username) {
            filter.username = {
                $eq: options.username
            };
        }
        if (options.email) {
            filter.emails = {
                $elemMatch: {
                    address: options.email
                }
            };
        }
        console.log('Finding user ' + JSON.stringify(filter));
        const user = Meteor.users.findOne(filter);
        if (user) {
            return;
        }

        console.log('Creating user ' + JSON.stringify(filter));

        // Create user
        const userId = Accounts.createUser(options);

        if (!userId) {
            console.log('User cannot be created');
            return;
        }
    };

    // Create demo user
    if (Meteor.settings.public.demoUserEnabled) {
        createUser(demoUserOptions);
    }

    createUser({
        username: 'kevin',
        password: 'K63exEZeaD9+rKg2Kzc(JXpz',
        profile: {
            fullName: 'Kevin'
        }
    });

    createUser({
        username: 's4l4x',
        password: 'MA2VAjfZhvq;VRw9.9B9pKaQ',
        profile: {
            fullName: 'Alessandro Sabatelli'
        }
    });

    createUser({
        username: 'petithelico',
        password: 'uFTR,CJ47N%kvEgT9DEMPh2T',
        profile: {
            fullName: 'Alessandro Sabatelli'
        }
    });

    createUser({
        username: 'electra',
        password: 'mq2ZadoqjzW49Vm>G9VEs%Cf',
        profile: {
            fullName: 'Electra Kaloudis'
        }
    });

    createUser({
        username: 'pardeep',
        password: 'thx?CjWbx8cXod3K?3aiU4KE',
        profile: {
            fullName: 'Pardeep Athwal'
        }
    });

    createUser({
        username: 'medisol',
        password: 'pabUcG2kt89]cfc*Kx7BkQRG',
        profile: {
            fullName: 'Medisol'
        }
    });
});
