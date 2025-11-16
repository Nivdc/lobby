import { arraysEqual, getRandomElement } from "./utils.js"

export const originalGameData = {
    factions: [
        {
            name:'Town',
            roleVariationList:[
                {
                    abilityNames:undefined,
                    name: "Citizen",
                },
                {
                    abilityNames:['RevealAsMayor'],
                    name: "Mayor",
                },
                {
                    abilityNames:['RevealAsMarshall'],
                    name: "Marshall",
                },
                {
                    abilityNames:['Detect'],
                    name: "Sheriff",
                },
                {
                    abilityNames:['Track'],
                    name: "Detective",
                },
                {
                    abilityNames:['Monitor'],
                    name: "Lookout",
                },
                {
                    abilityNames:['Heal'],
                    name: "Doctor",
                },
                {
                    abilityNames:['RoleBlock'],
                    name: "Escort",
                },
                {
                    abilityNames:['Swap'],
                    name: "BusDriver",
                },
                {
                    defaultTeamName:"DetectTeam",
                    name: "AuxiliaryOfficer",
                },
                {
                    abilityNames:['ArmedGuard'],
                    name: "Veteran",
                },
                {
                    abilityNames:['Attack'],
                    name: "Vigilante",
                },
                {
                    effectNames:['RadioBroadcast'],
                    name: "Crier",
                },
                {
                    abilityNames:['CloseProtection'],
                    name: "Bodyguard",
                },
            ],
            victoryCheck(game){
                const hasMemberRemaining = game.queryAlivePlayersByRoleFaction(this.name).length > 0
                const isLastSurvivingFaction = game.queryAliveMajorFactionPlayers_except(this.name).length === 0
                const neutralEvilDoesNotExist = game.queryAliveNeutralPlayersByRoleTag('Evil').length === 0
                const neutralKillingDoesNotExist = game.queryAliveNeutralPlayersByRoleTag('Killing').length === 0

                if(hasMemberRemaining && isLastSurvivingFaction && neutralEvilDoesNotExist && neutralKillingDoesNotExist){
                    return true
                }
                else if(hasMemberRemaining === false){
                    return false
                }
                return undefined
            },
        },
        {
            name:'Mafia',
            allMembersAreOnDefaultTeam:'AttackTeam',
            roleVariationList:[
                {
                    abilityNames:undefined,
                    name: "Mafioso",
                },
                {
                    abilityNames:undefined,
                    name: "Godfather",
                },
                {
                    abilityNames:['RoleBlock'],
                    name:'Consort'
                },
                {
                    abilityNames:['Silence'],
                    name:'Blackmailer'
                },
            ],
            victoryCheck(game){
                const hasMemberRemaining = game.queryAlivePlayersByRoleFaction(this.name).length > 0
                const isLastSurvivingFaction = game.queryAliveMajorFactionPlayers_except(this.name).length === 0
                const neutralKillingDoesNotExist = game.queryAliveNeutralPlayersByRoleTag('Killing').length === 0

                if(hasMemberRemaining && isLastSurvivingFaction && neutralKillingDoesNotExist){
                    return true
                }
                else if(hasMemberRemaining === false){
                    return false
                }
                return undefined
            },
        },
    ],
    tags: [
        {
            name: "Killing",
            includeRoleNames: [
                "Vigilante",
                "Bodyguard",
                "Veteran",

                "Mafioso",
                "Godfather",

                "SerialKiller",
            ]
        },
        {
            name: "Protective",
            includeRoleNames: [
                "Doctor",
                "Escort",
                "Bodyguard",
                "BusDriver"
            ]
        },
        {
            name: "Government",
            includeRoleNames: [
                "Citizen",
                "Crier",
                "Marshall",
                "Mayor"
            ]
        },
        {
            name: "Investigative",
            includeRoleNames: [
                "Detective",
                "Lookout",
                "Sheriff",
            ]
        },
        {
            name:"Evil",
            includeRoleNames: [
                "SerialKiller"
            ]
        },
        {
            name:"Team",
            includeRoleNames: [] // auto generate
        }
    ],

    // ability其实很简单，它就是驱动逻辑
    // 玩家使用了某项技能之后，它就会根据游戏数据改变游戏数据，就这么简单
    // 根据改变时机的不同，ability有两种效果，立刻改变游戏数据，或是延迟到夜晚再改变游戏数据。
    // 团队使用的ability和个人是一样的，区别在于团队通过机制和投票选出执行人和目标，且会在生成action的时候附带一些team数据。

    // 记住，无论你想要实现多么复杂的功能，game这个大对象里面已经包含了一切所需要的数据，it is All in One.

    // 在编写generateNightAction的时候我们要注意，虽然action这个命名隐含着强烈的动作意味
    // 但在这个游戏中，action是，且只是一种数据，一种abilityRecord，
    // 它的作用是帮助gameDirector判断夜间发生了什么，并最终结算结果
    // 也正因为action本质上是一种abilityRecord，因此action.name = ability.name

    // 如果说gameDirector是线下游戏的主持人，那么这个action就是玩家在夜间递给主持人的小纸条
    // 上面写明了自己想要在今晚干什么

    // 也就是说使用一个ability分为两个部分，能不能用ability？ 和 用了ability会产生什么效果？
    // 此处的ability只用于解决第一个问题，第二个问题则要交由gameDirector处理
    // 我觉得这么做是很自然且符合逻辑，试想如果我们在线下玩这类游戏，如果我想要声明我今晚要攻击你，
    // 我是会直接对你：“你今晚被我攻击了”，然后你再来告诉我：“我死了”或者是“我身上有防弹衣，所以我不会死”吗？
    // 肯定不会是这样，肯定是要由主持人来结算夜间发生的事情的

    // 也许在其他游戏中攻击的实现方法不是这样的，但是在这个游戏中，我觉得只有这样才是正确的。

    // 两种特殊的ability类型Attack和Protect将会有特殊的处理行为。

    // 如果没有编写自己的处理逻辑，技能将会遵循default里的处理逻辑
    // 调用优先顺序是这样的: (各个ability里的内容) -> default对象里的内容 -> class Ability里的内容(如果有的话)
    // 我们仔细考虑一下这个结构，它实际上是添加了一个类型系统
    //
    // 传统的对象模型可能是这样的:
    //                                                ┌───► Attack      
    //                                                │                 
    //   AbilityBase ────► Ability┬─► TargetedAbility ┴───► Heal        
    //                            │                                     
    //                            └─► EnabledAbility  ────► BulletProof 
    //
    //
    // 而在我们的实现中，基于JS强大的灵活性，它是这样的: 
    //                                                            ┌───► "Attack"       
    //                                                            │                    
    //                             ┌──► targetedAbilities.default ┴───► "Heal"         
    //                             │                                                   
    //                             │                                                   
    //   AbilityBase ────► Ability ┴──► enabledAbilities.default  ────► "BulletProof"  
    //
    // 我现在还判断不出两种模式的优劣，也许它们实际上殊途同归，但是我愿意尝试下面这条路子
    // 尽管当前的实现方式在语法上可能看不出来它的继承，但是它在事实（接口）上确实是继承的
    // 我们应该特别注意到，下面这种继承方式，与JS的原型链设计、Proxy类有着密不可分的关系

    // 也许我使上浑身解数弄出来的这个抽象玩意，只是为了少写几个class 和 extend 和 constructor ？
    // 值了！......吗？代价是什么呢...
    
    // 如前所述，游戏中存在着两类的技能：能够及时造成效果的 和 延迟到夜晚造成效果的。
    // 但是现有的技能又分成两类：指向型 和 启用型
    // 这是一个分类方法的问题，我暂时决定以现有的技能分类为主，先观察一下会出现什么情况
    abilities:{
        targetedAbilities: {
            default:{
                use(game, data){
                    const target = game.playerList[data.targetIndex]
                    if(target !== undefined && this.verify(game, this.player.index, target.index) && this.state.unableToUse === false){
                        this.target = target
                        this.player.sendEvent('UseAblitySuccess', data)
                    }else{
                        this.player.sendEvent('UseAblityFailed', data)
                    }
                },

                verify(game, userIndex, targetIndex, previousTargetIndex) {
                    const userIsAlive = game.playerList[userIndex].isAlive
                    const userIsNotTarget = userIndex !== targetIndex
                    const targetIsNotPreviousTarget = targetIndex !== previousTargetIndex
                    const targetIsAlive = game.playerList[targetIndex].isAlive
                    return userIsAlive && userIsNotTarget && targetIsNotPreviousTarget && targetIsAlive
                },
            
                cancel(game, data){
                    this.target = undefined
                    this.player.sendEvent('UseAblityCancelSuccess', data)
                },
            
                generateNightAction(){
                    if(this.target !== undefined){
                        const abilityTarget = this.target
                        this.target = undefined
                        this.addUsageCount()
                        return {name:this.name, origin:this.player, target:abilityTarget}
                    }else{
                        this.resetConsecutiveUsageCount()
                        return undefined
                    }
                },
            
                createAbilityTeamVote(game){
                    const v = new Vote(game, this.teamVoteData)
                    return v
                },
            
                generateTeamNightAction(executor, target){
                    if(executor && target){
                        return {name:this.name, origin:executor, target}
                    }
                    return undefined
                },
            },
            "Attack": {
                verify(game, userIndex, targetIndex, previousTargetIndex) {
                    const userIsAlive = game.playerList[userIndex].isAlive
                    const targetIsAlive = game.playerList[targetIndex].isAlive
                    const targetIsNotPreviousTarget = targetIndex !== previousTargetIndex
                    return userIsAlive && targetIsAlive && targetIsNotPreviousTarget
                },
                teamVoteData: {
                    name: "AttackVote",
                    verify(game, voterIndex, targetIndex, previousTargetIndex) {
                        const voterIsAlive = game.playerList[voterIndex].isAlive
                        const targetIsAlive = game.playerList[targetIndex].isAlive
                        const targetIsNotPreviousTarget = targetIndex !== previousTargetIndex
                        return voterIsAlive && targetIsAlive && targetIsNotPreviousTarget
                    },
                    getResultIndexArray(game, count) {
                        const voteMax = count.reduce((a, b) => Math.max(a, b), -Infinity)
                        if (voteMax > 0) {
                            const voteMaxIndexArray = count
                                .map((vc, idx) => (vc === voteMax ? idx : undefined))
                                .filter((vidx) => vidx !== undefined)
                            return voteMaxIndexArray
                        }
                        return undefined
                    }
                }
            },
            "Heal": {
                verify(game, userIndex, targetIndex, previousTargetIndex) {
                    const userIsAlive = game.playerList[userIndex].isAlive
                    const userIsNotTarget = userIndex !== targetIndex
                    const targetIsNotPreviousTarget = targetIndex !== previousTargetIndex
                    const targetIsNotDead_yet = game.playerList[targetIndex].isAlive
                    return userIsAlive && userIsNotTarget && targetIsNotPreviousTarget && targetIsNotDead_yet
                }
            },
            "RoleBlock": {
                verify(game, userIndex, targetIndex, previousTargetIndex) {
                    const userIsAlive = game.playerList[userIndex].isAlive
                    const userIsNotTarget = userIndex !== targetIndex
                    const targetIsNotPreviousTarget = targetIndex !== previousTargetIndex
                    const targetIsAlive = game.playerList[targetIndex].isAlive
                    const targetIsNotUserTeamMember =
                        game.playerList[userIndex].team?.playerList.map((p) => p.index).includes(targetIndex) !== true
                    return userIsAlive && userIsNotTarget && targetIsNotPreviousTarget && targetIsAlive && targetIsNotUserTeamMember
                }
            },
            "Silence": {
            },
            "Detect": {
                teamVoteData: {
                    name: "DetectVote",
                    verify(game, voterIndex, targetIndex, previousTargetIndex) {
                        const voterIsAlive = game.playerList[voterIndex].isAlive
                        const targetIsAlive = game.playerList[targetIndex].isAlive
                        const targetIsNotPreviousTarget = targetIndex !== previousTargetIndex
                        const targetIsNotAuxiliaryOfficer =
                            game.playerList[voterIndex].team.playerList.map((p) => p.index).includes(targetIndex) === false
                        return voterIsAlive && targetIsAlive && targetIsNotPreviousTarget && targetIsNotAuxiliaryOfficer
                    },
                    getResultIndexArray(game, count) {
                        const voteMax = count.reduce((a, b) => Math.max(a, b), -Infinity)
                        if (voteMax > 0) {
                            const voteMaxIndexArray = count
                                .map((vc, idx) => (vc === voteMax ? idx : undefined))
                                .filter((vidx) => vidx !== undefined)
                            return voteMaxIndexArray
                        }
                        return undefined
                    }
                }
            },
            "Track": {
            },
            "CloseProtection":{
            },
            'Monitor':{
                verify(game, userIndex, targetIndex, previousTargetIndex) {
                    const userIsAlive = game.playerList[userIndex].isAlive
                    const targetIsAlive = game.playerList[targetIndex].isAlive
                    const targetIsNotPreviousTarget = targetIndex !== previousTargetIndex
                    return userIsAlive && targetIsAlive && targetIsNotPreviousTarget
                },
            },

            'Swap':{
                use(game, data){
                    const target_1 = game.playerList[data.targetIndex_1]
                    const target_2 = game.playerList[data.targetIndex_2]
                    if(this.verify(game, this.player.index, target_1.index, target_2.index) && this.state.unableToUse === false){
                        this.target_1 = target_1
                        this.target_2 = target_2
                        this.player.sendEvent('UseAblitySuccess', data)
                    }else{
                        this.player.sendEvent('UseAblityFailed', data)
                    }
                },

                verify(game, userIndex, targetIndex_1, targetIndex_2) {
                    const userIsAlive = game.playerList[userIndex].isAlive
                    const target_1_isAlive = game.playerList[targetIndex_1].isAlive
                    const target_2_isAlive = game.playerList[targetIndex_2].isAlive
                    const target_1_isNot_target_2 = targetIndex_1 !== targetIndex_2
                    return userIsAlive && target_1_isAlive && target_2_isAlive && target_1_isNot_target_2
                },
            
                cancel(game, data){
                    this.target_1 = undefined
                    this.target_2 = undefined
                    this.player.sendEvent('UseAblityCancelSuccess', data)
                },
            
                generateNightAction(){
                    if(this.target_1 && this.target_2){
                        const action = {
                            name:this.name, 
                            origin:this.player, 
                            target_1:this.target_1, 
                            target_2:this.target_2
                        }
                        
                        this.target_1 = undefined
                        this.target_2 = undefined
                        this.addUsageCount()
                        return action
                    }else{
                        this.resetConsecutiveUsageCount()
                        return undefined
                    }
                },
            }
        },

        enabledAbilities: {
            default:{
                use(game, data){
                    if(this.verify(game, this.player.index) && this.state.unableToUse === false){
                        this.enable = true
                        this.player.sendEvent('UseAblitySuccess', data)
                    }else{
                        this.player.sendEvent('UseAblityFailed', data)
                    }
                },

                verify(game, userIndex, targetIndex, previousTargetIndex){
                    const userIsAlive = game.playerList[userIndex].isAlive
                    return userIsAlive
                },
            
                cancel(game, data){
                    if(this.enable){
                        this.enable = false
                        this.player.sendEvent('UseAblityCancelSuccess', data)
                    }
                },
            
                generateNightAction(){
                    if(this.enable === true){
                        this.enable = undefined
                        this.addUsageCount()
                        return {name:this.name, origin:this.player}
                    }else{
                        this.resetConsecutiveUsageCount()
                        return undefined
                    }
                },
            },

            "BulletProof":{
            },

            "RevealAsMayor":{
                use(game, data){
                    if(this.verify(game, this.player.index) && this.state.unableToUse === false){
                        game.gameDirector.immediatelyUseAbility(this.player, data)
                        this.player.sendEvent('UseAblitySuccess', data)
                    }else{
                        this.player.sendEvent('UseAblityFailed', data)
                    }
                },

                verify(game, userIndex, targetIndex, previousTargetIndex){
                    const userIsAlive = game.playerList[userIndex].isAlive
                    const inDayStage = game.status.split('/').includes('day')
                    const userHasNotBeenSilenced = game.playerList[userIndex].effects.has('Silenced') === false
                    return userIsAlive && inDayStage && userHasNotBeenSilenced
                },

                cancel(game, data){
                    this.player.sendEvent('UseAblityCancelFailed', data)
                },

                generateNightAction:undefined,
            },

            "RevealAsMarshall":{
                use(game, data){
                    if(this.verify(game, this.player.index) && this.state.unableToUse === false){
                        game.gameDirector.immediatelyUseAbility(this.player, data)
                        this.player.sendEvent('UseAblitySuccess', data)
                    }else{
                        this.player.sendEvent('UseAblityFailed', data)
                    }
                },

                verify(game, userIndex, targetIndex, previousTargetIndex){
                    const userIsAlive = game.playerList[userIndex].isAlive
                    const inDayStage = game.status.split('/').includes('day')
                    const notInTrialOrExecutionStage = game.inTrialOrExecutionStage === false
                    const userHasNotBeenSilenced = game.playerList[userIndex].effects.has('Silenced') === false
                    return userIsAlive && inDayStage && userHasNotBeenSilenced && notInTrialOrExecutionStage
                },

                cancel(game, data){
                    this.player.sendEvent('UseAblityCancelFailed', data)
                },

                generateNightAction:undefined,
            },

            'ArmedGuard':{
            }
        }
    },
    // 在阵营内的角色现在是自动生成的，详见faction中的roleVariationList
    // 下方只有中立角色
    roles: [
        {
            name:'SerialKiller',
            abilityNames:['Attack'],
            victoryCheck(game, player){
                return player.isAlive
            }
        }
    ],
    votes: [
        {
            name: "LynchVote",
            verify: (game, voterIndex, voteData, previousVoteData)=>{
                const targetIndex = voteData
                const previousTargetIndex = previousVoteData
                if(Number.isInteger(targetIndex)){
                    let voterIsAlive = game.playerList[voterIndex].isAlive
                    let targetIsAlive = game.playerList[targetIndex]?.isAlive
                    let targetIsNotPreviousTarget = (targetIndex !== previousTargetIndex)
                    // 为什么玩家不能给自己投票？我觉得他可以啊
                    // let targetIsNotVoter = (voterIndex !== targetIndex)
                    let gameStatusIncludesLynchVote = game.status.split('/').includes('lynchVote')
                    return voterIsAlive && targetIsAlive && targetIsNotPreviousTarget && gameStatusIncludesLynchVote
                }
                else{
                    return false
                }
            },
            getResultIndex(game, count){
                const apll = game.alivePlayerList.length
                const voteNeeded = apll % 2 === 0 ? ((apll / 2) + 1) : Math.ceil(apll / 2)
                const resultIndex = count.findIndex(c => c >= voteNeeded)
                return  resultIndex >= 0 ? resultIndex : undefined
            }
        },
        {
            name: "TrialVote",
            verify: (game, voterIndex, voteData, previousVoteData)=>{
                if(typeof(voteData) === 'boolean'){
                    let voterIsAlive = game.playerList[voterIndex].isAlive
                    let voterIsNotTrialTarget = voterIndex !== game.trialTarget?.index
                    let voteDataIsNotPreviousVoteData = voteData !== previousVoteData
                    let gameStatusIncludesTrialVote = game.status.split('/').includes('trialVote')
                    return voterIsAlive && voterIsNotTrialTarget && voteDataIsNotPreviousVoteData && gameStatusIncludesTrialVote
                }
            },
            getResultBoolean(game, record){
                const guiltyCount = record.filter(r => r === true).length
                const innocentCount = record.filter(r => r === false).length

                return guiltyCount > innocentCount
            }
        }

    ],
    teams: [
        {
            name: "AttackTeam",
            abilityNames:['Attack'],
        }, 

        {
            name:"DetectTeam",
            abilityNames:['Detect'],
        }
    ]
}

// 兜兜转转又回来了...
gameDataInit()
function gameDataInit(){
    rolesInit()
    tagsInit()
    
    function rolesInit(){
        for(const f of originalGameData.factions){
            if('roleVariationList' in f){
                for(const rv of f.roleVariationList){
                    let role = {...{
                        defaultAffiliationName:f.name,
                    }, ...rv}

                    for (const keyName in role) {
                        if (role[keyName] === undefined) {
                            delete role[keyName]
                        }
                    }

                    originalGameData.roles.push(role)
                }
            }
        }
    }

    function tagsInit(){
        const tagSet = originalGameData.tags
        const teamTag = tagSet.find(t => t.name === 'Team')
    
        if(teamTag.includeRoleNames.length === 0){        
            const defaultAffiliationTable = getDefaultAffiliationTable()
            for(const f of originalGameData.factions){
                if('allMembersAreOnDefaultTeam' in f){
                    const factionMemberRoleNames = defaultAffiliationTable.find(fTag => fTag.name === f.name).includeRoleNames
                    teamTag.includeRoleNames = teamTag.includeRoleNames.concat(factionMemberRoleNames)
                }
            }
    
            for(const r of originalGameData.roles){
                if('defaultTeamName' in r && r.defaultTeamName !== undefined){
                    if(teamTag.includeRoleNames.includes(r.name) === false){
                        teamTag.includeRoleNames.push(r.name)
                    }
                }
            }
        }

        for(const role of originalGameData.roles){
            if(role.tags === undefined){
                let tags = originalGameData.tags.map(t => t.includeRoleNames.includes(role.name)? t.name:undefined).filter(t => t !== undefined)
                tags = tags.length > 0 ? tags : undefined
        
                if(tags !== undefined)
                    role.tags = tags
            }
        }
    }
}

// faction是由玩家组成的集合，它有一个胜利目标
export class Faction{
    constructor(game, factionName){
        this.game = game
        this.playerList = []

        this.data = originalGameData.factions.find(f => f.name === factionName)
        if(this.data === undefined) console.error(`Unknow faction Name: ${factionName}`);
        if('victoryCheck' in this.data === false) console.error(`Faction: ${factionName} has no 'victoryCheck' function`);

        return new Proxy(this, {
            get(target, prop) {
                return prop in target ? target[prop] : target.data[prop]
            }
        })
    }

    get alivePlayerList(){
        return this.playerList.filter(p => p.isAlive)
    }

    victoryCheck(){
        return this.data.victoryCheck(this.game)
    }
}

class AbilityBase{
    constructor(game, player, abilityName, roleModifyObject){
        this.game = game
        this.player = player // owner

        this.state = {
            unableToUseCheckFunctions:[
                function(){
                    return this.forceDisableRounds > 0
                },
            ],
            get unableToUse(){
                return this.unableToUseCheckFunctions.some(f => f.call(this))
            },
            consecutiveUsageCount:0,
            usageCount:0,
            forceDisableRounds:0,
        }

        if(roleModifyObject){
            // consecutiveAbilityUses_2_Cause_1_NightCooldown
            // note: 注意这里想要造成多于1晚的冷却是不合理的，因为只要有1晚冷却了，就不能算是连续使用了呀...
            if(roleModifyObject['consecutiveAbilityUses_2_Cause_1_NightCooldown']){
                const consecutiveAbilityUsesLimit = 2
                const causeNightColldownNumber = 1
                this.state.unableToUseCheckFunctions.push(
                    function(){
                        let v = (this.consecutiveUsageCount + 1) % (consecutiveAbilityUsesLimit + causeNightColldownNumber)
                        if(v === 0)
                            v = (consecutiveAbilityUsesLimit + causeNightColldownNumber)
    
                        return v > consecutiveAbilityUsesLimit
                    }
                )
            }

            // hasAbilityUsesLimit_*_Times
            // note: 基于下面的代码，同名的modify选项只有第一个为true的会生效
            const roleModifyObjectKeyNames = Object.keys(roleModifyObject)
            if(roleModifyObjectKeyNames.filter(keyName => keyName.startsWith('hasAbilityUsesLimit_')).length > 0){
                const options = roleModifyObjectKeyNames.filter(keyName => keyName.startsWith('hasAbilityUsesLimit_'))
                for(const oName of options){
                    if(roleModifyObject[oName]){
                        const usesLimit = extractNumbers(oName)[0]
                        this.state.unableToUseCheckFunctions.push(
                            function(){
                                return this.usageCount >= usesLimit
                            }
                        )

                        break
                    }
                }
            }

            // hasAbilityForceDisableRound_*_AtStart
            if(roleModifyObjectKeyNames.filter(keyName => keyName.startsWith('hasAbilityForceDisableRound_')).length > 0){
                const options = roleModifyObjectKeyNames.filter(keyName => keyName.startsWith('hasAbilityForceDisableRound_'))
                for(const oName of options){
                    if(roleModifyObject[oName]){
                        const extraForceDisableRound = extractNumbers(oName)[0]
                        this.state.forceDisableRounds += extraForceDisableRound

                        break
                    }
                }
            }

            // hasAbility_*_UsesLimit_*_Times
            for(const keyName in roleModifyObject ){
                if(keyName.startsWith('hasAbility_')){
                    const extraAbilityName = keyName.split('_')[1]
                    if(keyName.split('_').includes('UsesLimit')){
                        const usesLimit = extractNumbers(keyName)[0]
                        if(abilityName === extraAbilityName){
                            this.state.unableToUseCheckFunctions.push(
                                function(){
                                    return this.usageCount >= usesLimit
                                }
                            )
                        }
                    }
                }
            }
        }
    }

    addUsageCount(){
        this.state.consecutiveUsageCount ++
        this.state.usageCount ++
    }

    resetConsecutiveUsageCount(){
        this.state.consecutiveUsageCount = 0
    }

    reduceForceDisableRounds(){
        if(this.state.forceDisableRounds > 0)
            this.state.forceDisableRounds --
    }
}

// 技能类
// 注意在这个类中类会合并default对象的行为和各个ability对象的特殊行为，且后者会对前者进行覆盖
// 且代理对象会优先调用data里面的同名数据
// 也就是说，调用优先顺序是这样的: (各个ability里的内容) -> default对象里的内容 -> class Ability里的内容(如果有的话)
class Ability extends AbilityBase{
    constructor(game, player, abilityName, roleModifyObject){
        super(game, player, abilityName, roleModifyObject)

        this.name = abilityName
        for(const abilityTypeName in originalGameData.abilities){
            this.data = originalGameData.abilities[abilityTypeName][abilityName]
            if(this.data !== undefined){
                this.data = {...originalGameData.abilities[abilityTypeName].default, ...this.data}
                break
            }
        }

        if(this.data === undefined) console.error(`Unknow Ability: ${abilityName}`);
        if(this.data.verify === undefined) console.error(`Ability: ${abilityName} has no 'verify' Function`);

        // 在大多数情况下，我们的代理类是想要拦截data里面没有的内容的访问，比如说data里面没有get方法，但是代理对象有的时候，
        // proxy就会将对get的访问转移给代理对象，但是在这里，我们的操作则截然相反，
        // 即，如果data里面有函数可用，则优先调用data里面的函数，而忽视本身的函数。
        return new Proxy(this, {
            get(target, prop, receiver) {
                return prop in target.data  === false ? target[prop] : 
                    typeof target.data[prop] === 'function' ? target.data[prop].bind(receiver) : target.data[prop]
            }
        })
    }
}

export class EffectManager{
    constructor(){
        this.effects = []
        return new Proxy(this, {
            get(target, prop) {
                return prop in target ? target[prop] : target.effects[prop]
            }
        })
    }

    add(name, durationRounds = Infinity, extraData = undefined){
        this.effects.push({...(extraData || {}), name, durationRounds})
    }
    add_skipThisRound(name, durationRounds, extraData){
        this.effects.add(name, (durationRounds+1), extraData)
    }
    remove(eName){
        this.effects = this.effects.filter(e => e.name !== eName)
    }
    get(eName){
        return this.search(e => e.name === eName)
    }
    has(eName){
        return this.effects.map(e => e.name).includes(eName)
    }
    search(searchFunction){
        return this.effects.find(searchFunction)
    }
    reduceDurationRounds(){
        this.effects.forEach(e => e.durationRounds -= 1)
        this.effects = this.effects.filter(e => e.durationRounds > 0)
    }
}

// 仁慈的父，我已坠入，看不见罪的国度，请原谅我的自负~
export class Role{
    constructor(game, player, roleData){
        this.game   = game
        this.player = player
        this.name   = roleData.name

        const defaultRoleData = originalGameData.roles.find(r => r.name === roleData.name)
        this.affiliationName = roleData.affiliationName ?? defaultRoleData.defaultAffiliationName ?? undefined

        this.data = defaultRoleData
        this.tags = defaultRoleData.tags

        const factionMemberDefaultTeamName = originalGameData.factions.find(f => f.name === this.affiliationName)?.allMembersAreOnDefaultTeam
        this.teamName = roleData.teamName ?? defaultRoleData.defaultTeamName ?? factionMemberDefaultTeamName ?? undefined

        const abilityNames = defaultRoleData.abilityNames ?? []

        this.effects = new EffectManager()

        if(this.modifyObject){
            for(const keyName in this.modifyObject ){
                if(keyName.startsWith('hasEffect_')){
                    const effectName = keyName.split('_')[1]
                    if(this.modifyObject[keyName])
                        this.effects.add(effectName)
                }
                else if(keyName.startsWith('hasAbility_')){
                    const extraAbilityName = keyName.split('_')[1]
                    if(this.modifyObject[keyName])
                        abilityNames.push(extraAbilityName)
                }
            }
        }

        if('effectNames' in this.data){
            this.data.effectNames.forEach(effectName => this.effects.add(effectName))
        }

        if(abilityNames !== undefined){
            this.abilities = []
            for(const aName of abilityNames){
                this.abilities.push(new Ability(this.game, this.player, aName, this.modifyObject))
            }
        }
    }

    get modifyObject(){
        const roleNameLowerCase = this.name.charAt(0).toLowerCase() + this.name.slice(1)
        return this.game.setting.roleModifyOptions[roleNameLowerCase]
    }

    useAblity(data){
        if(this.abilities.length === 1){
            var ability = this.abilities[0]
        }
        else if('name' in data){
            var ability = this.abilities.find(a => a.name === data.name)
        }

        ability?.use(this.game, data)
    }

    useAblityCancel(data){
        if(this.abilities.length === 1){
            var ability = this.abilities[0]
        }
        else if('name' in data){
            var ability = this.abilities.find(a => a.name === data.name)
        }

        ability?.cancel(this.game, data)
    }

    generateNightActions(){
        const actions = []
        if(this.abilities !== undefined)
        for(const a of this.abilities.filter(ability => ability.generateNightAction !== undefined)){
            const action = a.generateNightAction()
            if(action !== undefined)
                actions.push(action)
        }

        return actions
    }

    victoryCheck(){
        return this.data.victoryCheck?.(this.game, this.player)
    }

    reduceEffectsDurationRounds(){
        this.effects.reduceDurationRounds()

        this.abilities?.forEach(a => a.reduceForceDisableRounds())
    }
    addAbilityForceDisableRounds(durationRounds = 0){
        this.abilities.forEach(a => a.state.forceDisableRounds += durationRounds)
    }

    toJSON(){
        return {
            name:this.name,
            abilityNames:this.abilities?.map(a => a.name)
        }
    }
}

// 在这个类中，
// record记录了谁投票给谁，record[1]读取出来的就是2号玩家投票的对象
// 而count记录的是得票情况，count[1]读取出来的就是2号玩家得了几票
export class Vote{
    constructor(game, data){
        this.game = game
        this.data = data
        this.record = new Array(game.playerList.length).fill(undefined)
        if(this.data.verify === undefined) console.error(`Vote: ${data.name} has no 'verify' Function`);


        if(Object.keys(data).find(k => k.startsWith('getResult')) === undefined)
            console.error(data.name, ' Unable to get results')
    }

    get name(){
        return this.data.name
    }

    get type(){
        return this.data.name
    }

    playerVote(voterIndex, voteData){
        const previousVoteData = this.record[voterIndex]
        const success = this.verify(this.game, voterIndex, voteData, previousVoteData)
        if(success){
            this.record[voterIndex] = voteData
            const voteCount = this.getCount()
            return {success, previousVoteData, voteCount}
        }

        return {success:false}
    }

    playerVoteCancel(voterIndex){
        const previousVoteData = this.record[voterIndex]
        if(previousVoteData !== undefined){
            this.record[voterIndex] = undefined
            const voteCount = this.getCount()
            return {success:true, previousVoteData, voteCount}
        }

        return {success:false}
    }

    getCount(){
        const count = new Array(this.record.length).fill(0)
        for(const [voterIndex, targetIndex] of this.record.entries()){
            const p = this.game.playerList[voterIndex]
            if(targetIndex !== undefined){
                let voteWeight = 1
                if(this.team && p.role.name === this.team.defaultLeaderRoleName){
                    voteWeight = (p.team.playerList.length + 1)
                }
                else if(this.team === undefined){
                    voteWeight = p.effects.get('HasPublicVoteWeight')?.voteWeight ?? 1
                }

                count[targetIndex] += voteWeight
            }
        }

        return count
    }

    getResult(){
        if('getResultIndex' in this.data)
            return this.data.getResultIndex(this.game, this.getCount())
        else if('getResultBoolean' in this.data)
            return this.data.getResultBoolean(this.game, this.record)
        else if('getResultIndexArray' in this.data)
            return this.data.getResultIndexArray(this.game, this.getCount())
    }

    getResultIndex(){
        if('getResultIndex' in this.data)
            return this.data.getResultIndex(this.game, this.getCount())
    }

    getResultIndexArray(){
        if('getResultIndexArray' in this.data)
            return this.data.getResultIndexArray(this.game, this.getCount())
    }

    resetRecord(){
        this.record = this.record.fill(undefined)
    }

    verify(game, voterIndex, voteData, previousTargetIndex){
        return this.data.verify(game, voterIndex, voteData, previousTargetIndex)
    }
    // cancelVerify(game, record, voterIndex){
    //     return this.data.cancelVerify(game, record, voterIndex)
    // }
}

// Team原本的设计是与玩家的身份完全隔离的，它只是一种PlayerGroup
// 也就是说游戏是支持将玩家分组到各个团队里面的，但是我发现我们做不到完全隔离
// 因为这里面临着一个团队行动由谁来执行，抽取执行人的问题（以及团队领袖有额外投票权的问题
// 所以...目前的解决方案就是写死在代码里面，Mafia执行人就是Mafioso，三和就是暴徒，共济会就是长老，邪教就是邪教徒
// 除此之外，游戏还会在白天开始时检测团队有无执行人，并检测团队有无可变身为执行人的角色
// 如果没有预定的角色名，则会在团队成员中随机抽取
export class Team{
    constructor(game, affiliationName, teamName){
        this.game = game
        this.name = teamName
        this.affiliationName = affiliationName

        this.playerList = []

        const data = originalGameData.teams.find(t => t.name === this.name)
        if(data === undefined)
            console.error('Unknow TeamName:', this.name)

        if('abilityNames' in data){
            this.abilities = []
            this.abilityVotes = []
            for(const aName of data.abilityNames){
                const ability = new Ability(this.game, undefined, aName)
                this.abilities.push(ability)
                const vote = ability.createAbilityTeamVote(game)
                vote.team = this
                this.abilityVotes.push(vote)
            }
        }
    }

    sendEventToAliveMember(eventType, data){
        return this.game.sendEventToGroup(this.alivePlayerList, eventType, data)
    }

    get alivePlayerList(){
        return this.playerList.filter(p => p.isAlive)
    }

    get defaultLeaderRoleName(){
        const defaultLeaderRoleNameList = {
            'Mafia':{
                default:"Godfather"
            },
        }

        return defaultLeaderRoleNameList[this.affiliationName]?.[this.name] ?? defaultLeaderRoleNameList[this.affiliationName]?.default
    }

    get leaders(){
        return this.alivePlayerList.filter(p => p.role.name === this.defaultLeaderRoleName)
    }

    get defaultExecutionRoleName(){
        const defaultExecutionRoleNameList = {
            'Town':{
                'DetectTeam':'AuxiliaryOfficer',
            },
            'Mafia':{
                'AttackTeam':'Mafioso',
            },
        }

        return defaultExecutionRoleNameList[this.affiliationName]?.[this.name]
    }

    get defaultExecutionMembers(){
        return this.alivePlayerList.filter(p => p.role.name === this.defaultExecutionRoleName)
    }

    get executableTeamMembers(){
        if(this.defaultExecutionMembers.length === 0){
            var canBeExecutorMembers = this.alivePlayerList.filter(p => p.role.modifyObject?.['canBeTeamActionExecutor'] === true)
        }
        return this.defaultExecutionMembers.length > 0 ? this.defaultExecutionMembers : canBeExecutorMembers
    }

    checkTeamHasActionExecutor(){
        if(this.defaultExecutionMembers.length === 0){
            const convertiblePlayer = this.alivePlayerList.find(p => p.role.modifyObject?.['canBeTurnedIntoTeamExecutor'] === true)
            if(convertiblePlayer !== undefined){
                convertiblePlayer.setRole({name:this.defaultExecutionRoleName})
                this.sendEventToAliveMember('SetTeam', this)
            }
        }
    }

    playerVote(voter, voteData){
        if(this.abilities.length === 1){
            const ability = this.abilities[0]
            const vote = this.abilityVotes[0]
            const voterIndex = voter.index
            const targetIndex = voteData
            const oldAbilityTargets = vote.getResultIndexArray()
            const {success, previousTargetIndex, voteCount} = vote.playerVote(voterIndex, voteData)
            if(success){
                this.sendEventToAliveMember('TeamVote', {teamAbilityName:ability.name, voterIndex, targetIndex, previousTargetIndex})

                const newAbilityTargets = vote.getResultIndexArray()
                if(arraysEqual(oldAbilityTargets, newAbilityTargets) === false){
                    this.sendEventToAliveMember('TeamAbilityTargetsNotice', {teamAbilityName:ability.name, targets:newAbilityTargets})
                }
            }
        }
    }
    playerVoteCancel(voter, voteData){
        if(this.abilities.length === 1){
            const ability = this.abilities[0]
            const vote = this.abilityVotes[0]
            const voterIndex = voter.index
            const oldAbilityTargets = vote.getResultIndexArray()
            const {success, previousTargetIndex, voteCount} = vote.playerVoteCancel(voterIndex)
            if(success){
                this.sendEventToAliveMember('TeamVoteCancel', {teamAbilityName:ability.name, voterIndex, previousTargetIndex})
                
                const newAbilityTargets = vote.getResultIndexArray()
                if(arraysEqual(oldAbilityTargets, newAbilityTargets) === false){
                    this.sendEventToAliveMember('TeamAbilityTargetsNotice', {teamAbilityName:ability.name, targets:newAbilityTargets})
                }
            }
        }
    }

    generateNightActions(){
        let actionSequence = []
        for(const [index, ability] of this.abilities.entries()){
            const actionExecutor = getRandomElement(this.executableTeamMembers)

            const abilityVote = this.abilityVotes[index]
            if(abilityVote.getResultIndexArray() !== undefined){
                const abilityTargetIndex = getRandomElement(abilityVote.getResultIndexArray())
                const abilityTarget = this.game.playerList[abilityTargetIndex]

                const action = ability.generateTeamNightAction(actionExecutor, abilityTarget)
                if(action !== undefined){
                    action.isTeamAction = true
                    actionSequence.push(action)
                    this.sendEventToAliveMember('TeamNightActionNotice', {name:action.name, originIndex:action.origin.index, targetIndex:action.target.index})
                }
            }

            abilityVote.resetRecord()
        }

        return actionSequence
    }

    toJSON(){
        return {
            name:this.name,
            affiliationName:this.affiliationName,
            abilityNames:this.abilities?.map(a => a.name),
            memberPlayerData:this.playerList.map(p => p.toJSON_includeRole())
        }
    }
}

// // 下面这个输出是用来调试的，和浏览器环境不兼容因此只能注释掉
// if(require.main === module){
//     // console.log(gameDataInit({playerList:[]}))
//     // console.log(getDefaultAffiliationTable())
//     console.log(originalGameData)
// }

// function createAbility(game, user, abilityName, role){
//     if(user.constructor.name === 'Player'){
//         return 
//     }
// }

function extractNumbers(str) {
    return str?.match(/\d+/g).map(Number) ?? []
}

function getDefaultAffiliationTable(){
    let  defaultAffiliationTable = []
    const roles = originalGameData.roles
    const factionNameSet = new Set(roles.map(r => r.defaultAffiliationName))
    for(const factionName of factionNameSet){
        defaultAffiliationTable.push({
            name:factionName,
            includeRoleNames:roles.filter(r => r.defaultAffiliationName === factionName).map(r => r.name)
        })
    }

    return defaultAffiliationTable
}

export function getRoleTags(roleName){
    const role = originalGameData.roles.find(r => r.name === roleName)
    return role.tags
}

export function abilityUseVerify(game, abilityName, userIndex, targetIndex, previousTargetIndex){
    for(const abilityTypeName in originalGameData.abilities){
        var ability = originalGameData.abilities[abilityTypeName][abilityName]
        if(ability !== undefined){
            ability = {...originalGameData.abilities[abilityTypeName].default, ...ability}
            break
        }
    }

    if(ability === undefined) console.error(`Unknow Ability: ${abilityName}`);
    if(ability.verify === undefined) console.error(`Ability: ${abilityName} has no 'verify' Function`);

    return ability?.verify(game, userIndex, targetIndex, previousTargetIndex)
}

export function teamVoteVerify(game, team, teamAbilityName, {voterIndex, targetIndex, previousTargetIndex}){
    const voteVerify = originalGameData.abilities.targetedAbilities[teamAbilityName].teamVoteData.verify
    return voteVerify(game, voterIndex, targetIndex, previousTargetIndex)
}

export function publicVoteVerify(game, voteTypeName, {voterIndex, targetIndex, previousTargetIndex}){
    const vote = originalGameData.votes.find(v => v.name === voteTypeName)
    return vote.verify(game, voterIndex, targetIndex, previousTargetIndex)
}