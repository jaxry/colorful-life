function RulePresets() {

    var activeFamily;

    var familyLife = [
        {
            name: 'Dry Life',
            rule: '23/37'
        },
        {
            name: '2x2',
            rule: '125/36'
        },
        {
            name: '34 Life',
            rule: '34/34'
        },
        {
            name: 'Amoeba',
            rule: '1358/357'
        },
        {
            name: 'Assimilation',
            rule: '4567/345'
        },
        {
            name: 'Coagulations',
            rule: '235678/378'
        },
        {
            name: 'Conway\'s Life',
            rule: '23/3'        
        },
        {
            name: 'Coral',
            rule: '45678/3'
        },
        {
            name: 'Day & Night',
            rule: '34678/3678'
        },
        {
            name: 'Diamoeba',
            rule: '5678/35678'
        },
        {
            name: 'Dot Life',
            rule: '023/3'
        },
        {
            name: 'Flakes',
            rule: '012345678/3'
        },
        {
            name: 'Fredkin',
            rule: '02468/1357'
        },
        {
            name: 'Gnarl',
            rule: '1/1'
        },
        {
            name: 'High Life',
            rule: '23/36'
        },
        {
            name: 'Live Free or Die',
            rule: '0/2'
        },
        {
            name: 'Long life',
            rule: '5/345'
        },
        {
            name: 'Maze',
            rule: '12345/3'
        },
        {
            name: 'Mazectric',
            rule: '1234/3'
        },
        {
            name: 'Move',
            rule: '245/368'
        },
        {
            name: 'Pseudo life',
            rule: '238/357'
        },
        {
            name: 'Replicator',
            rule: '1357/1357'
        },
        {
            name: 'Seeds',
            rule: '/2'
        },
        {
            name: 'Serviettes',
            rule: '/234'
        },
        {
            name: 'Stains',
            rule: '235678/3678'
        },
        {
            name: 'Vote',
            rule: '45678/5678'
        },
        {
            name: 'Vote 4/5',
            rule: '45678/5678'
        },
        {
            name: 'Walled Cities',
            rule: '2345/45678'
        }
    ];

    var familyGenerations = [
        {
            name: 'Banners',
            rule: '2367/3457/5'
        },
        {
            name: 'BelZhab',
            rule: '23/23/8'
        },
        {
            name: 'BelZhab Sediment',
            rule: '145678/23/8'
        },
        {
            name: 'Bloomerang',
            rule: '234/34678/24'
        },
        {
            name: 'Bombers',
            rule: '345/24/25'
        },
        {
            name: 'Brain 6',
            rule: '6/246/3'
        },
        {
            name: 'Brian\'s Brain',
            rule: '/2/3'
        },
        {
            name: 'Burst',
            rule: '0235678/3468/9'
        },
        {
            name: 'Burst II',
            rule: '235678/3468/9'
        },
        {
            name: 'Caterpillars',
            rule: '124567/378/4'
        },
        {
            name: 'Chenille',
            rule: '05678/24567/6'
        },
        {
            name: 'Circuit Genesis',
            rule: '2345/1234/8'
        },
        {
            name: 'Cooties',
            rule: '23/2/8'
        },
        {
            name: 'Ebb&Flow',
            rule: '012478/36/18'
        },
        {
            name: 'Ebb&Flow II',
            rule: '012468/37/18'
        },
        {
            name: 'Faders',
            rule: '2/2/25'
        },
        {
            name: 'Fireworks',
            rule: '2/13/21'
        },
        {
            name: 'Flaming Starbows',
            rule: '347/23/8'
        },
        {
            name: 'Frogs',
            rule: '12/34/3'
        },
        {
            name: 'Frozen spirals',
            rule: '356/23/6'
        },
        {
            name: 'Glisserati',
            rule: '035678/245678/7'
        },
        {
            name: 'Glissergy',
            rule: '035678/245678/5'
        },
        {
            name: 'Lava',
            rule: '12345/45678/8'
        },
        {
            name: 'Lines',
            rule: '012345/458/3'
        },
        {
            name: 'Living On The Edge',
            rule: '345/3/6'
        },
        {
            name: 'Meteor Guns',
            rule: '01245678/3/8'
        },
        {
            name: 'Nova',
            rule: '45678/2478/25'
        },
        {
            name: 'OrthoGo',
            rule: '3/2/4'
        },
        {
            name: 'Prairie on fire',
            rule: '345/34/6'
        },
        {
            name: 'RainZha',
            rule: '2/23/8'
        },
        {
            name: 'Rake',
            rule: '3467/2678/6'
        },
        {
            name: 'SediMental',
            rule: '45678/25678/4'
        },
        {
            name: 'Snake',
            rule: '03467/25/6'
        },
        {
            name: 'SoftFreeze',
            rule: '13458/38/6'
        },
        {
            name: 'Spirals',
            rule: '2/234/5'
        },
        {
            name: 'Star Wars',
            rule: '345/2/4'
        },
        {
            name: 'Sticks',
            rule: '3456/2/6'
        },
        {
            name: 'Swirl',
            rule: '23/34/8'
        },
        {
            name: 'ThrillGrill',
            rule: '1234/34/48'
        },
        {
            name: 'Transers',
            rule: '345/26/5'
        },
        {
            name: 'Transers II',
            rule: '0345/26/6'
        },
        {
            name: 'Wanderers',
            rule: '345/34678/5'
        },
        {
            name: 'Worms',
            rule: '3467/25/6'
        },
        {
            name: 'Xtasy',
            rule: '1456/2356/16'
        }
    ];

    this.getRule = function(index) {

        var alive = new Array(9);
        var dead = new Array(9);
        for (var i = 0; i < alive.length; i++) {
            alive[i] = false;
            dead[i] = false;
        }

        var s = activeFamily[index].rule;

        var i = 0;
        while (s[i] != '/') {
            alive[Number(s[i++])] = true;
        }

        i++;
        while (s[i] != null){

            if (s[i] == '/') return {'alive': alive, 'dead': dead, 'cellStates': s.slice(++i)};

            dead[Number(s[i++])] = true;
        }
    
        return {'alive': alive, 'dead': dead};
    };

    this.getNames = function() {

        obj = {};
        for (var i = 0; i < activeFamily.length; i++) {
            obj[activeFamily[i].name] = i;
        }

        return obj;
    };

    this.setFamilyLife = function() {
        activeFamily = familyLife;
    };

    this.setFamilyGenerations = function() {
        activeFamily = familyGenerations;
    };
}