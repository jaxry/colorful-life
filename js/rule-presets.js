function RulePresets() {

    var rules = [
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

    this.getRule = function(index) {

        var alive = new Array(9);
        var dead = new Array(9);
        for (var i = 0; i < alive.length; i++) {
            alive[i] = false;
            dead[i] = false;
        }

        var s = rules[index].rule;

        var i = 0;
        while (s[i] != '/') {
            alive[Number(s[i++])] = true;
        }

        i++;
        while (s[i] != null){
            dead[Number(s[i++])] = true;
        }
    
        return {'alive': alive, 'dead': dead}
    };

    this.getNames = function() {

        obj = {}
        for (var i = 0; i < rules.length; i++) {
            obj[ rules[i].name ] = i;
        }

        return obj;
    };
}