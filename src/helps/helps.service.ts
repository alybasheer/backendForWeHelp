import { Injectable, NotFoundException } from '@nestjs/common';

@Injectable()
export class HelpsService {
    private helps = [

        {id: 1, title: 'Stuck in the Traffic', time: '2 hours ago', category : 'General Problem'},
        {id: 2, title: 'A+ Blood Needed', time: '1 hours ago', category : 'humanitarian Help'},
        {id: 3, title: 'Imediate Evacuation needed', time: '50 mint ago', category : 'Natural Disaster'},
        {id: 4, title: 'Landsliding', time: '4 mint ago', category : 'Natural Disaster'},
    ];
    getAllHelps() {
        return this.helps;
    }
    getByCategory(category : String){
        return this.helps.find(help => help.category === category);
    }
    //Post
    addNewHelp(data : {title : string, time: string, category : string}){
        const newHelp = {
            id : Date.now(),
            ...data
        };
        this.helps.push(newHelp);
        
    };
    //put
    UpdateHelp(id : number, data: {title: string, time: string, category : string}){
        const helpIndex =  this.helps.findIndex((help) => help.id === id);
        if(helpIndex === -1)  throw new NotFoundException('Not Found');
           this.helps[helpIndex] = {id , ...data};
        return this.helps[helpIndex];
    }
    //Patch
    PatchHelp(id : number, data: Partial<{title: string, time: string, category : string}>){
        const helpIndex =  this.helps.findIndex((help) => help.id === id);
        if(helpIndex === -1)  throw new NotFoundException('Not Found');
           this.helps[helpIndex] = { ...this.helps[helpIndex], ...data};
        return this.helps[helpIndex];
    }
    
}
